---
category: primeros-pasos
title: ¿Cómo edito los datos de mi negocio?
slug: como-editar-los-datos-de-mi-negocio
summary: En Mi negocio cambias el nombre, el logo, el color, la moneda, la zona horaria, los datos fiscales y la configuración del punto de venta.
module: settings
routes: [/business]
tags: [mi negocio, logo, moneda, rut, iva, propina, mesas, meseros, configuracion]
position: 3
---

Los datos de tu negocio se editan en **Negocio → Mi negocio**, en la pestaña **General**. Cada sección tiene su propio botón **Guardar**. Si te arrepientes antes de guardar, toca **Descartar**.

## Identidad

- **Nombre del negocio**: escribe el nuevo nombre y toca **Guardar**.
- **Logo del negocio**: elige una imagen y toca **Guardar logo**, o usa **Quitar logo** para eliminarlo.
- **Color de marca**: toca un color. Se guarda al instante y cambia la app de todo tu equipo: botones, menú, login y POS.

## Moneda y horario

Aquí eliges la **Moneda** y la **Zona horaria** que usan los pedidos, los turnos y los reportes. Si cambias la moneda, los precios no se convierten: tus productos mantienen el mismo número. Revísalos después del cambio.

## Datos fiscales

- **RUT del negocio** (opcional): se valida el dígito verificador.
- **IVA (%)**: en Chile es 19 %.
- **Los precios de mis productos**:
  - *Incluyen IVA*: el precio es lo que paga el cliente. Es lo habitual en Chile.
  - *No incluyen IVA*: el precio es neto y el IVA se suma al vender.

El cambio aplica a las líneas que agregues desde ahora. Los pedidos ya creados no cambian.

## Punto de venta

- **Trabajo con mesas**: muestra el panel de mesas en el POS para asignar una mesa a cada pedido. Si lo apagas, el POS trabaja solo en mostrador y el catálogo ocupa más espacio.
- **Uso meseros**: el POS pregunta "¿Quién atiende?" para dejar cada pedido a nombre de un mesero. Si lo apagas, el POS entra directo sin elegir mesero.
- **Mesero obligatorio al tomar pedidos**: quita la opción de continuar sin mesero en el POS. Solo se activa si *Uso meseros* está encendido.
- **Caja y turnos**: el turno se abre con un fondo de caja y se cierra con arqueo ciego y reporte Z. Si está apagado, el POS cobra sin caja.
- **Propina sugerida (%)**: se propone al cobrar y en la precuenta. Usa 0 si no quieres sugerir propina.
- **Reparto de propinas**: *Cada mesero lo suyo*, *Partes iguales* o *Por puntos*. Es el modo por defecto, y puedes cambiarlo en cada liquidación.

La pestaña **Inventario** tiene la configuración de stock.

## Errores comunes

- **"RUT inválido. Revisa el dígito verificador."**: revisa el número y el dígito final.
- **"Debe estar entre 0 y 100."** o **"Máximo 2 decimales."**: corrige el IVA o la propina.
- **"Cierra las cajas abiertas primero"**: no puedes apagar *Caja y turnos* mientras haya turnos abiertos. Ciérralos en **POS → Turnos de caja**.
- **"No tienes permiso para esta acción."**: tu rol no permite editar el negocio. Pídele al dueño que lo haga.
