# 🚀 Pasos para Activar el Envío de Correos

## ✅ Paso 1: Obtener API Key de Resend

1. Ve a **https://resend.com** y crea una cuenta gratuita
2. Inicia sesión
3. En el dashboard, ve a **API Keys** (o Settings → API Keys)
4. Haz clic en **"Create API Key"**
5. Dale un nombre (ej: "APT Production")
6. **Copia la API key** (empieza con `re_...`)

⚠️ **IMPORTANTE**: Solo podrás ver la API key una vez, guárdala bien.

---

## ✅ Paso 2: Crear archivo `.env.local`

Crea manualmente el archivo `.env.local` en la carpeta `template-apt/` (donde está `package.json`):

**Ubicación exacta:** 
```
template-apt/.env.local
```

**Contenido del archivo:**
```env
RESEND_API_KEY=re_tu_api_key_aqui
```

Reemplaza `re_tu_api_key_aqui` con la API key real que copiaste.

**Ejemplo:**
```env
RESEND_API_KEY=re_abc123xyz789...
```

---

## ✅ Paso 3: Probar en Desarrollo (Opcional)

### Opción A: Con Vercel CLI (Recomendado - funciona completo)

```bash
# 1. Instalar Vercel CLI globalmente
npm install -g vercel

# 2. Desde la carpeta template-apt
vercel dev
```

Esto levanta el servidor y las funciones serverless funcionarán.

### Opción B: Solo Frontend (Sin funciones serverless)

```bash
npm run dev
```

⚠️ **Nota**: Con `npm run dev`, las funciones `/api/send-email` NO funcionarán en local, solo en producción en Vercel.

---

## ✅ Paso 4: Desplegar en Vercel (Producción)

### 4.1 Subir código a GitHub

```bash
# Si aún no tienes repo en GitHub
git init
git add .
git commit -m "Agregar funcionalidad de correos"
git branch -M main
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

### 4.2 Conectar con Vercel

1. Ve a **https://vercel.com** e inicia sesión
2. Haz clic en **"Add New Project"**
3. Conecta tu repositorio de GitHub
4. Vercel detectará automáticamente que es un proyecto Vite

### 4.3 Configurar Variable de Entorno en Vercel

1. En la configuración del proyecto, ve a **Settings**
2. Ve a **Environment Variables**
3. Agrega:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Tu API key de Resend
   - **Environment**: Marca las tres (Production, Preview, Development)
4. Haz clic en **Save**

### 4.4 Deploy

Vercel desplegará automáticamente. Las funciones en `api/` funcionarán en:
```
https://tu-proyecto.vercel.app/api/send-email
```

---

## ✅ Paso 5: Probar que Funciona

### Desde el código React:

```typescript
import { sendEmail } from '@/lib/email';

// Ejemplo de uso
const resultado = await sendEmail({
  to: "tu-email@ejemplo.com",
  subject: "Prueba APT",
  html: "<h1>Hola</h1><p>Correo de prueba desde APT.</p>"
});

if (resultado.ok) {
  console.log("✅ Correo enviado:", resultado.id);
} else {
  console.error("❌ Error:", resultado.error);
}
```

### Con cURL (si ya está desplegado):

```bash
curl -X POST https://tu-proyecto.vercel.app/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "destino@correo.com",
    "subject": "Prueba",
    "html": "<h1>Hola</h1>"
  }'
```

---

## ⚠️ Actualizar Dominio "From" (Después de la primera prueba)

Cuando estés listo para producción:

1. Ve a Resend Dashboard → **Domains**
2. Agrega y verifica tu dominio
3. Edita `api/send-email.ts`:

```typescript
from: "APT Taller <noreply@tudominio.com>", // Tu dominio verificado
```

Para pruebas, puedes usar:
```typescript
from: "onboarding@resend.dev", // Solo para desarrollo
```

---

## 📋 Checklist

- [ ] Creé cuenta en Resend
- [ ] Obtuve mi API key de Resend
- [ ] Creé el archivo `.env.local` con mi API key
- [ ] (Opcional) Instalé Vercel CLI y probé con `vercel dev`
- [ ] Subí el código a GitHub
- [ ] Conecté el repo en Vercel
- [ ] Configuré `RESEND_API_KEY` en Vercel Environment Variables
- [ ] Desplegué en Vercel
- [ ] Probé enviar un correo de prueba

---

## 🆘 Problemas Comunes

### "Could not read package.json"
**Solución**: Asegúrate de estar en la carpeta `template-apt/`:
```bash
cd template-apt
```

### "ENOENT: no such file or directory, open '.env.local'"
**Solución**: Crea el archivo `.env.local` manualmente en `template-apt/`

### El correo no se envía en desarrollo local
**Solución**: Usa `vercel dev` en lugar de `npm run dev`

### "Invalid API key" en producción
**Solución**: Verifica que agregaste `RESEND_API_KEY` en Vercel Environment Variables

---

## 📚 Más Información

Ver `EMAIL_SETUP.md` para documentación completa y ejemplos avanzados.




