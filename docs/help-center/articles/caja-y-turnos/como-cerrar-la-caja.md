---
category: caja-y-turnos
title: ¿Cómo cierro la caja?
slug: como-cerrar-la-caja
summary: Cierre ciego contando billetes y monedas desde el panel del turno; al cerrar ves el reporte Z con faltante o sobrante.
module: cash
routes: [/pos, /cash/sessions/:id]
tags: [cerrar caja, arqueo, arqueo ciego, reporte z, faltante, sobrante]
position: 3
---

La caja se cierra desde el POS: abres el panel del turno, cuentas el efectivo por billetes y monedas y confirmas. Al terminar ves el reporte Z con la diferencia.

Solo aplica si tienes activado *Caja y turnos* en Mi negocio → Punto de venta.

## Pasos

1. En **POS → Tomar pedido**, toca el indicador verde de la caja.
2. En el panel del turno, toca **Cerrar caja**.
3. En **Efectivo**, indica cuántos billetes y monedas hay de cada valor ($20.000, $10.000, $5.000, $2.000, $1.000, $500, $100, $50 y $10). Usa **+** y **−** o escribe la cantidad. El *Total efectivo contado* se suma solo.
4. En **Otros medios (opcional)**, anota los totales de Débito, Crédito, Transferencia u Otro según el cierre del POS de Transbank o la cartola. Si no los tienes, déjalos vacíos.
5. Si quieres, agrega **Notas** del cierre.
6. Toca **Cerrar caja** y confirma en el mensaje *¿Cerrar Caja principal?*.

## Arqueo ciego

Cuentas lo que hay en la caja sin ver lo que el sistema espera. Así el conteo es honesto. Una vez cerrada, el conteo no se puede modificar.

## Después de cerrar

Se abre el reporte Z del turno. En **Efectivo en caja** ves *Esperado*, *Contado* y *Diferencia*:

- **Cuadrada**: el conteo coincide.
- **Faltante** (en rojo): hay menos efectivo del esperado.
- **Sobrante** (en verde): hay más efectivo del esperado.

Toca **Imprimir reporte Z** para tener la copia en papel.

## Errores comunes

- **"No contaste efectivo: se cerrará con $0 en caja"**: aparece si no ingresaste billetes ni monedas. Toca **Volver** y cuenta.
- **"Las notas no pueden superar los 1.000 caracteres"**: acorta las notas.
- **"El turno ya se cerró."**: otro equipo cerró esta caja antes que tú.
- **"No se pudo abrir la impresión"**: revisa que el navegador permita abrir la ventana de impresión.
