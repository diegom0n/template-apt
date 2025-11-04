# 📧 Configuración de Envío de Correos - Resend + Vercel

## ✅ Instalación Completada

1. ✅ Librería `resend` instalada
2. ✅ Endpoint serverless creado: `api/send-email.ts`
3. ✅ Función helper creada: `src/lib/email.ts`

## 🔧 Configuración

### 1. Obtener API Key de Resend

1. Ve a [https://resend.com](https://resend.com)
2. Crea una cuenta gratuita
3. Ve a **API Keys** en el dashboard
4. Crea una nueva API key y cópiala

### 2. Configurar Variables de Entorno

#### Desarrollo Local

Crea un archivo `.env.local` en la raíz del proyecto:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
```

**⚠️ IMPORTANTE**: El archivo `.env.local` ya está en `.gitignore` y no se subirá a Git.

#### Producción (Vercel)

1. Ve a tu proyecto en [Vercel](https://vercel.com)
2. Ve a **Settings** → **Environment Variables**
3. Agrega:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Tu API key de Resend
   - **Environment**: Production, Preview, Development

### 3. Configurar Dominio en Resend (Opcional pero Recomendado)

1. En el dashboard de Resend, ve a **Domains**
2. Agrega y verifica tu dominio
3. Actualiza el `from` en `api/send-email.ts`:

```typescript
from: "APT Taller <noreply@tudominio.com>", // Cambia a tu dominio verificado
```

Para pruebas, puedes usar el dominio de prueba de Resend:
```typescript
from: "onboarding@resend.dev", // Solo para desarrollo/pruebas
```

## 🚀 Desarrollo Local

### Opción A: Usar Vercel CLI (Recomendado)

Las funciones serverless solo funcionan con Vercel CLI en desarrollo:

```bash
# Instalar Vercel CLI globalmente
npm install -g vercel

# Iniciar servidor de desarrollo
vercel dev
```

Esto levantará tanto el frontend (Vite) como las funciones serverless.

### Opción B: Solo Frontend

Si solo quieres trabajar en el frontend:

```bash
npm run dev
```

**Nota**: Las llamadas a `/api/send-email` fallarán en desarrollo local sin Vercel CLI, pero funcionarán en producción.

## 💻 Uso en tu Código React

### Ejemplo Básico

```typescript
import { sendEmail } from '@/lib/email';

// En un componente o función
const handleSendEmail = async () => {
  const result = await sendEmail({
    to: "destino@correo.com",
    subject: "Prueba APT",
    html: "<h1>Hola</h1><p>Correo de prueba desde APT.</p>"
  });

  if (result.ok) {
    console.log("Correo enviado:", result.id);
  } else {
    console.error("Error:", result.error);
  }
};
```

### Ejemplo con Template HTML Completo

```typescript
import { sendEmail } from '@/lib/email';

const sendWorkOrderNotification = async (orderData: any) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: #1f2937; color: white; padding: 20px; }
          .content { padding: 20px; background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>APT Taller - Nueva Orden de Trabajo</h1>
          </div>
          <div class="content">
            <h2>Orden #${orderData.id}</h2>
            <p><strong>Chofer:</strong> ${orderData.chofer}</p>
            <p><strong>Vehículo:</strong> ${orderData.vehiculo}</p>
            <p><strong>Descripción:</strong> ${orderData.descripcion}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const result = await sendEmail({
    to: orderData.email_chofer,
    subject: `Nueva Orden de Trabajo #${orderData.id}`,
    html
  });

  return result;
};
```

### Ejemplo en un Componente React

```typescript
import { useState } from 'react';
import { sendEmail } from '@/lib/email';

export function EmailForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const result = await sendEmail({
        to: 'admin@tudominio.com',
        subject: 'Notificación de Sistema',
        html: '<p>Este es un correo de prueba.</p>'
      });

      if (result.ok) {
        setMessage('✅ Correo enviado correctamente');
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar Correo'}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
}
```

## 🚢 Despliegue

### 1. Sube tu código a GitHub

```bash
git add .
git commit -m "Agregar funcionalidad de envío de correos"
git push
```

### 2. Conecta con Vercel

1. Ve a [Vercel](https://vercel.com)
2. Importa tu repositorio de GitHub
3. Vercel detectará automáticamente que es un proyecto Vite/React

### 3. Configura Variables de Entorno

En Vercel → Project Settings → Environment Variables:
- `RESEND_API_KEY` = Tu API key de Resend

### 4. Deploy

Vercel desplegará automáticamente. Las funciones en `api/` se convertirán en endpoints serverless automáticamente.

## 🧪 Probar el Endpoint

### Con cURL

```bash
curl -X POST https://tu-proyecto.vercel.app/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "destino@correo.com",
    "subject": "Prueba",
    "html": "<h1>Hola</h1>"
  }'
```

### Con fetch en el navegador

```javascript
fetch('/api/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'destino@correo.com',
    subject: 'Prueba',
    html: '<h1>Hola</h1>'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

## 📝 Notas Importantes

- ✅ **Plan Gratis**: Resend ofrece 3,000 correos/mes gratis
- ✅ **Sin SMTP**: Resend usa API, más estable en serverless
- ✅ **Funciones Serverless**: Se ejecutan solo cuando se llaman
- ⚠️ **Desarrollo Local**: Usa `vercel dev` para probar las funciones serverless
- ⚠️ **Dominio Verificado**: Para producción, verifica tu dominio en Resend

## 🔗 Recursos

- [Documentación de Resend](https://resend.com/docs)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Ejemplos de Templates HTML](https://resend.com/docs/send-with-nodejs)


