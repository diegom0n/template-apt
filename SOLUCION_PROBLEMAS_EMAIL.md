# 🔧 Solución de Problemas - Correos No Se Envían

## ⚠️ Problema: El correo no se envía al conceder acceso

### Paso 1: Verificar cómo estás ejecutando el servidor

**IMPORTANTE**: Las funciones serverless (`/api/send-email`) solo funcionan con `vercel dev`, NO con `npm run dev`.

#### ❌ Incorrecto:
```bash
npm run dev
```
Esto ejecuta solo Vite, las funciones serverless no funcionan.

#### ✅ Correcto:
```bash
# 1. Instalar Vercel CLI (si no lo tienes)
npm install -g vercel

# 2. Ejecutar con Vercel
vercel dev
```

### Paso 2: Revisar la consola del navegador

1. Abre la consola del navegador (F12 o clic derecho → Inspeccionar)
2. Ve a la pestaña "Console"
3. Intenta registrar un ingreso de vehículo
4. Busca los mensajes que empiezan con 📧

**Mensajes esperados:**
- `📧 Intentando enviar correo de notificación...`
- `📧 Destinatario: dwerdecker@gmail.com`
- `📧 Enviando correo a: ...`
- `📧 Respuesta del servidor - Status: 200`

### Paso 3: Errores comunes y soluciones

#### Error: "Failed to fetch" o "Network error"
**Causa**: El endpoint `/api/send-email` no está disponible.

**Solución**:
- Ejecuta `vercel dev` en lugar de `npm run dev`
- Verifica que la carpeta `api/` existe en la raíz del proyecto
- Verifica que `api/send-email.ts` existe

#### Error: "404 Not Found"
**Causa**: La ruta `/api/send-email` no se encuentra.

**Solución**:
- Asegúrate de estar usando `vercel dev`
- Verifica que el archivo `api/send-email.ts` existe
- Reinicia el servidor con `vercel dev`

#### Error: "500 Internal Server Error" o "Invalid API key"
**Causa**: La API key de Resend no está configurada o es incorrecta.

**Solución**:
1. Verifica que `.env.local` existe en la raíz del proyecto
2. Verifica que contiene: `RESEND_API_KEY=re_...`
3. Si usas `vercel dev`, asegúrate de que también lee el `.env.local`
4. En producción (Vercel), verifica que agregaste `RESEND_API_KEY` en Environment Variables

#### No aparece ningún error, pero no llega el correo
**Causa**: El correo se envió pero puede estar en spam o la API key no tiene permisos.

**Soluciones**:
1. Revisa la carpeta de **Spam/Promociones** en Gmail
2. Verifica que tu API key de Resend esté activa
3. Revisa los logs en Resend Dashboard → Logs
4. Verifica que el email destinatario esté bien escrito

### Paso 4: Verificar configuración

#### Archivo `.env.local`:
```env
RESEND_API_KEY=re_3MmW8vAL_3h76AMZsdmHAGY3jw37C7rDr
VITE_ADMIN_EMAIL=dwerdecker@gmail.com  # Opcional
```

#### En `Gate.tsx`:
El email por defecto es `dwerdecker@gmail.com` si no configuras `VITE_ADMIN_EMAIL`.

### Paso 5: Probar directamente el endpoint

Puedes probar el endpoint directamente desde la consola del navegador:

```javascript
fetch('/api/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'dwerdecker@gmail.com',
    subject: 'Prueba',
    html: '<h1>Test</h1>'
  })
})
.then(res => res.json())
.then(data => console.log('Resultado:', data))
.catch(err => console.error('Error:', err));
```

Si esto funciona, el problema está en otra parte del código.
Si esto falla, el problema es con las funciones serverless.

## 🚀 Solución Rápida

1. **Detén el servidor actual** (Ctrl+C)
2. **Ejecuta**: `vercel dev`
3. **Abre el navegador** en la URL que muestra Vercel
4. **Intenta registrar un ingreso**
5. **Revisa la consola** (F12) para ver los logs

## 📧 Verificar en Resend

1. Ve a [Resend Dashboard](https://resend.com/emails)
2. Ve a la sección **Logs** o **Emails**
3. Deberías ver los intentos de envío
4. Si hay errores, aparecerán aquí con detalles

## 🔍 Debug Avanzado

Si nada funciona, ejecuta esto en la consola del navegador después de intentar enviar:

```javascript
// Verificar que la función existe
console.log(typeof sendEmail);

// Verificar variables de entorno
console.log('Admin email:', import.meta.env.VITE_ADMIN_EMAIL);
```

## 💡 Nota Importante

- En **desarrollo local**: Necesitas `vercel dev` para que funcionen las funciones serverless
- En **producción (Vercel)**: Funciona automáticamente después del deploy
- El correo puede tardar unos segundos en llegar
- Revisa la carpeta de spam si no llega inmediatamente




