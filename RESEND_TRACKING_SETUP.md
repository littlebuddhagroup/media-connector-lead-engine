# Configuración de tracking de emails en Resend

Para que el tracking de aperturas y clicks funcione correctamente, debes configurar lo siguiente en el dashboard de Resend (resend.com):

## 1. Activar Open Tracking y Click Tracking

En el dashboard de Resend:
1. Ve a **Settings → Email Tracking**
2. Activa **Open Tracking** (píxel de seguimiento 1x1)
3. Activa **Click Tracking** (wrapping de enlaces)

## 2. Configurar el Webhook

En el dashboard de Resend:
1. Ve a **Webhooks → Add Webhook**
2. URL: `https://lead.littlebuddhagroup.com/api/webhooks/resend`
3. Activa los eventos:
   - `email.delivered`
   - `email.opened`
   - `email.clicked`
   - `email.bounced`
4. Copia el **Signing Secret** (empieza por `whsec_...`)
5. Añádelo a tu `.env` como `RESEND_WEBHOOK_SECRET=whsec_...`

## 3. Variables de entorno necesarias

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=alicia@mymediaconnect.com
RESEND_FROM_NAME=Alicia Gómez — MyMediaConnect
RESEND_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://lead.littlebuddhagroup.com
```

## Notas

- El píxel de tracking solo funciona en emails HTML (no en texto plano)
- Algunos clientes de email bloquean los píxeles de tracking (Outlook, Apple Mail con protección de privacidad)
- Los clicks solo se trackean si el destinatario hace clic en un enlace del email
- El webhook debe ser accesible desde internet (no funciona en localhost salvo con ngrok)
