# 🍽️ Cardápio do Chef

Aplicativo mobile para garçons cadastrarem o **prato especial do dia** com foto tirada direto da cozinha, usando câmera nativa via Capacitor.

## ✨ Funcionalidades

- 📸 Captura de foto via **câmera nativa** ou **galeria** (CameraSource.Prompt)
- ✏️ Editor de imagem nativo após captura (allowEditing: true)
- ☁️ Upload de foto no **Supabase Storage** (bucket: `fotos-pratos`)
- 💾 Salvamento de pratos na **tabela Supabase** (`pratos`)
- 📋 Listagem de todos os pratos cadastrados
- 🛡️ Tratamento de cancelamento sem travar o app

## 🚀 Tecnologias

- **React 19** + **Vite**
- **Tailwind CSS v4**
- **Capacitor 8** (Android)
- **@capacitor/camera**
- **Supabase** (Banco de dados + Storage)

## ⚙️ Setup local

```bash
# Instalar dependências
npm install

# Criar arquivo .env com suas credenciais (veja .env.example)
cp .env.example .env

# Rodar em desenvolvimento
npm run dev

# Build + abrir Android Studio
npm run android
```

## 🗄️ Setup Supabase

1. Execute o arquivo `supabase_setup.sql` no **SQL Editor** do painel Supabase
2. No painel, vá em **Storage → New Bucket**:
   - Nome: `fotos-pratos`
   - ✅ Public bucket: **ON**

## 📁 Variáveis de ambiente

Crie um arquivo `.env` na raiz com:

```env
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
```

## 📜 Permissões Android

Configuradas no `AndroidManifest.xml`:
- `CAMERA`
- `READ_EXTERNAL_STORAGE` (Android ≤ 12)
- `READ_MEDIA_IMAGES` (Android 13+)
- `WRITE_EXTERNAL_STORAGE` (Android ≤ 9)
