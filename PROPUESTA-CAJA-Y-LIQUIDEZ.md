# Propuesta: Caja Operativa y Liquidez — Dear Cred

> Documento de análisis y diseño. Nace del feedback del cliente (Federico) a partir de una
> conversación con ChatGPT sobre el dashboard. El objetivo es: (1) dejar por escrito qué se
> puede hacer, cómo, y qué cuesta en esfuerzo; (2) servir de base para decidir qué entra en
> el alcance actual y qué debería cobrarse como módulo aparte.

---

## 1. Contexto

El dashboard actual ya muestra métricas sólidas para una financiera chica. El cliente, sin
embargo, planteó (vía ChatGPT) que le falta lo más importante para operar sin ahogarse:

> "¿Cuánta plata REAL tengo disponible para seguir operando?"

Las sugerencias concretas que trajo fueron:

1. **Caja operativa disponible** (disponible / mínimo necesario / excedente o déficit) — marcado como URGENTE
2. Separar cartera de **créditos rápidos** vs **productos/equipamiento**
3. Indicador de **liquidez futura** (próximos 7 días: cobranza esperada)
4. **Score automático de clientes** (verde / amarillo / rojo)
5. Separar **ganancia contable** de **caja disponible**

Este documento evalúa cada una.

---

## 2. Estado actual del dashboard

**Lo que muestra hoy** (`GET /dashboard`, con filtro de período `from`/`to`):

| Métrica | Detalle |
|---------|---------|
| Total adeudado | Saldo pendiente de todas las cuotas activas, con desglose CASH/PRODUCT y separación Prestado (capital) / Ganancia |
| Cobrado en el período | Pagos no anulados del período, con split Prestado / Ganancia |
| Puntualidad | % de clientes activos sin cuotas en mora |
| Clientes en mora | Lista de clientes con al menos una cuota OVERDUE |
| Efectivo vs Transferencia | Total cobrado en el período por método |
| Deuda por cliente | Saldo pendiente por préstamo, con capital |

**Lo que el sistema sabe** (modelo de datos): clientes, préstamos, cuotas, pagos. Es decir:
cuánto te deben, cuánto cobraste, y qué parte es capital vs interés.

---

## 3. El problema de fondo (clave para entender todo lo demás)

Hoy la app es un **registro de préstamos (loan ledger)**, no un **registro de caja
(treasury ledger)**.

El sistema **NO guarda en ningún lado**:

- El saldo de caja inicial con el que arrancó el negocio
- Los **retiros** que hace el dueño (plata que saca para uso personal)
- **Inyecciones** de capital nuevas
- **Gastos** operativos
- El **desembolso** de cada préstamo como un evento de salida de caja con fecha

**Consecuencia directa:** "caja real disponible hoy" **no es calculable** con los datos
actuales. Se podría inventar un número (ej. cobrado − prestado), pero sería falso porque
ignora el saldo inicial, los retiros y los gastos. Un número de caja equivocado es **peor que
no mostrarlo**: induce decisiones malas con falsa confianza.

Esta es la línea divisoria de todo el documento: **lo que es derivable de los datos actuales
es fácil; lo que requiere capturar datos nuevos de tesorería es un módulo aparte.**

---

## 4. Funcionalidades propuestas

### 4.1 — Indicador de liquidez futura (próximos días) ⭐ recomendado primero

**Qué es:** un bloque que responde "¿voy a quedar corto esta semana?". Muestra la cobranza
esperada en los próximos 7 / 15 / 30 días.

**Valor:** altísimo. Es exactamente la pregunta operativa del cliente, y se puede contestar
con los datos que ya tenemos.

**Viabilidad:** total. **Esfuerzo: BAJO (S).** No toca la base de datos.

**Diseño:**
- Nueva query de solo lectura: sumar el saldo pendiente (`amount − pagos no anulados`) de las
  cuotas con `status IN (PENDING, OVERDUE, PARTIALLY_PAID)` agrupadas por ventana de `dueDate`.
- Buckets sugeridos: **ya vencido sin cobrar** (dueDate < hoy), **por vencer en 7 días**,
  **8–15 días**, **16–30 días**.
- Separar "ya vencido" de "por vencer" es importante: lo vencido es cobranza dudosa, no
  proyección limpia.
- Opcional: desglose CASH vs PRODUCT en cada bucket.

**Salida del endpoint (ejemplo):**
```json
"expectedCollection": {
  "overdueUncollected": 320000,
  "next7Days": 540000,
  "next8To15Days": 410000,
  "next16To30Days": 600000
}
```

**Problemas / matices:**
- Es cobranza *esperada*, no asegurada. Hay que rotularlo así en la UI.
- No contempla mora futura (clientes que van a caer). Es un techo optimista.

---

### 4.2 — Caja operativa real (disponible / mínimo / déficit) 🔴 el más pesado

**Qué es:** el bloque grande arriba de todo que pidió el cliente:
```
Disponible:        $1.200.000
Mínimo operativo:  $2.000.000
Estado:            -$800.000  (déficit)
```

**Valor:** el más alto de todos según el cliente. **Pero requiere infraestructura nueva.**

**Viabilidad:** sí, pero **Esfuerzo: ALTO (L).** Requiere modelo de datos nuevo + UI de carga
+ disciplina operativa del dueño.

**Diseño — modelo de datos nuevo:**

```prisma
model CashMovement {
  id        String           @id @default(cuid())
  userId    String           // consistente con el patrón actual (Client.userId)
  type      CashMovementType
  amount    Float
  date      DateTime
  note      String?
  createdAt DateTime         @default(now())
}

enum CashMovementType {
  OPENING_BALANCE   // saldo inicial de caja (una sola vez)
  INJECTION         // aporte de capital nuevo
  WITHDRAWAL        // retiro del dueño
  EXPENSE           // gasto operativo
}
```

**Fórmula de caja disponible:**
```
cajaDisponible =
    OPENING_BALANCE
  + Σ INJECTION
  + Σ cobros (pagos no anulados)        ← auto, desde Payment
  − Σ desembolsos (principal de préstamos) ← auto, desde Loan.startDate
  − Σ WITHDRAWAL
  − Σ EXPENSE
```

Lo bueno: **cobros y desembolsos se auto-derivan** de lo que ya existe (Payment y Loan). Los
**únicos datos manuales nuevos** son: saldo inicial, inyecciones, retiros y gastos.

**Caja mínima + déficit/excedente:**
- La "caja mínima necesaria" es un número que configura el dueño (no se calcula).
- Necesita un lugar donde guardar config. No existe tabla de settings hoy → habría que agregar
  una tabla `Setting` simple (clave/valor por `userId`) o un registro único.
- `excedente = cajaDisponible − cajaMínima`. Trivial una vez que existe la caja.

**UI nueva necesaria:**
- Pantalla / sección para cargar movimientos de caja (alta de retiro, gasto, inyección).
- Campo de configuración de caja mínima.
- Bloque destacado en el dashboard.

**Problemas / riesgos (importantes):**
- ⚠️ **El riesgo no es el código, es operativo.** Si el dueño no registra retiros y gastos con
  disciplina, el número de caja se despega de la realidad y deja de servir.
- **Préstamos nullificados:** ¿el dinero salió de la caja o no? Si se nullifica un préstamo que
  ya se desembolsó, el capital igual salió. Si se nullifica antes de entregar, no. Hay que
  definir la regla (probablemente: el desembolso cuenta salvo que el préstamo se haya creado
  por error → manejarlo como un INJECTION de corrección).
- **Fecha de desembolso = `Loan.startDate`?** Hoy es la fecha de inicio del plan, que suele
  coincidir con la entrega del dinero, pero no es estrictamente "fecha en que entregué el
  efectivo". Para la mayoría de los casos alcanza; vale confirmarlo con el cliente.
- **Migración inicial:** al activar el módulo, el dueño tiene que cargar un saldo inicial
  honesto, si no la caja arranca mal.

---

### 4.3 — Separar cartera: créditos rápidos vs productos/equipamiento 🟢 ya casi está

**Qué es:** ver capital inmovilizado y retorno separado por tipo de operación (CASH vs PRODUCT).

**Estado actual:** ya existe `owedByType` (CASH/PRODUCT) en "Total adeudado". Falta extender la
misma lógica a "Cobrado" y a la liquidez futura.

**Viabilidad:** total. **Esfuerzo: BAJO (S).** Sin cambios de base de datos.

**Diseño:** replicar el split por `loan.type` en las métricas de cobrado y en los buckets de
liquidez futura (4.1). Opcional: mostrar "capital inmovilizado a >X días" cruzando con dueDates.

---

### 4.4 — Score automático de clientes (verde / amarillo / rojo) 🟡

**Qué es:** semáforo de prioridad por cliente, para decidir a quién renovar y a quién congelar.

**Valor:** alto para profesionalizar la cobranza. No es urgente como la caja.

**Viabilidad:** sí. **Esfuerzo: MEDIO (M).** Derivable de datos actuales, sin schema nuevo.

**Diseño — heurística simple (a validar con el cliente):**
- 🔴 **Rojo:** tiene cuotas OVERDUE hoy. → congelar renovación.
- 🟡 **Amarillo:** al día ahora, pero con historial de `LATE_PAID`, penalidades o pagos
  parciales. → vigilar.
- 🟢 **Verde:** siempre al día, sin penalidades ni atrasos. → premium.

Todo esto se calcula a partir de los `status` de las cuotas y su historial de pagos, que ya
están en la base.

**Problemas / matices:**
- La heurística hay que acordarla con el cliente (¿cuántos atrasos pasan de verde a amarillo?).
- Es trabajo de UI (badge por cliente en la lista + posible columna en el dashboard).

---

### 4.5 — Separar ganancia contable de caja disponible 🟢 reencuadre

**Qué es:** distinguir "estoy ganando mucho" de "tengo plata". Hoy el dashboard mezcla
conceptos.

**Aclaración importante:** la "Ganancia" que se muestra hoy (`totalOwed − totalPrincipalOwed`)
es **ganancia proyectada todavía NO cobrada**. No es plata en mano.

**Diseño — separar explícitamente tres conceptos:**
1. **Ganancia devengada / proyectada:** interés total de los préstamos activos (lo que ya
   muestra "Total adeudado → Ganancia"). Es expectativa.
2. **Ganancia realizada:** interés efectivamente cobrado en el período (parte del "Cobrado").
3. **Caja disponible:** líquido real (depende de 4.2).

**Viabilidad:** conceptos 1 y 2 ya existen, solo hay que rotularlos mejor → **Esfuerzo: BAJO.**
El concepto 3 (caja) depende del módulo 4.2.

---

## 5. Fases recomendadas

| Fase | Incluye | Esfuerzo | Toca DB |
|------|---------|----------|---------|
| **1 — Quick wins** | Liquidez futura (4.1) + split de cartera completo (4.3) + reencuadre ganancia/realizada (4.5 parcial) | Bajo | No |
| **2 — Módulo de caja** | Caja real (4.2): modelo `CashMovement`, tabla de settings, UI de carga, bloque de caja + mínimo + déficit, ganancia vs caja (4.5 completo) | Alto | Sí |
| **3 — Inteligencia** | Score de clientes (4.4) | Medio | No |

Recomendación: arrancar por **Fase 1**, que es barata y responde gran parte de la inquietud del
cliente ("¿voy a quedar corto?") sin tocar la base de datos. La **Fase 2** es el pedido
"urgente" pero es el verdadero módulo nuevo.

---

## 6. ¿Se debería cobrar aparte?

Marco para la decisión (no es una decisión técnica, es comercial — esto es solo el insumo):

**Argumentos para que sea parte del alcance / mejora incluida:**
- Las fases 1 y 3 son **mejoras sobre el dashboard existente**. No agregan entidades nuevas al
  sistema; reordenan y enriquecen lo que ya se calcula. Encajan en "pulir lo entregado".
- Son de bajo/medio esfuerzo y no cambian la arquitectura.

**Argumentos para cobrar la Fase 2 (caja) como módulo aparte:**
- Es **funcionalidad nueva, no un retoque**: introduce un concepto que el sistema nunca tuvo
  (tesorería), con su propio modelo de datos, sus pantallas de carga y reglas de negocio
  nuevas (desembolsos, retiros, nullificados, saldo inicial).
- Cambia la naturaleza del producto: de "gestor de préstamos" a "gestor de préstamos + control
  de caja". Eso es expansión de alcance, no corrección.
- Genera **soporte y mantenimiento continuo** (reglas de nullificados, conciliación de caja).
- Requiere trabajo de **acompañamiento operativo** (enseñarle al cliente a cargar retiros y
  gastos), que es valor adicional.

**Sugerencia de encuadre honesto para el cliente:**
- Fase 1 (liquidez futura + reencuadre) se puede ofrecer como mejora incluida o de bajo costo —
  da una gran sensación de valor rápido.
- Fase 2 (módulo de caja) se justifica cotizarla aparte: es un módulo nuevo con datos, pantallas
  y lógica propios. Es lo que el cliente identificó como lo más valioso, y efectivamente lo es.

---

## 7. Resumen en una línea

La dirección del análisis es buena y viable. Lo más fácil (liquidez futura, splits, score) es
derivable de los datos actuales; lo más valioso y "urgente" (caja real) es el único punto que
exige construir un módulo de tesorería desde cero, y es el candidato natural a cobrarse aparte.
