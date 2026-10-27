-- ============================================================
-- SETUP SUPABASE — Cardápio do Chef
-- Execute este script no SQL Editor do painel Supabase
-- Project: https://eerlfwixtkrvogtaxcqx.supabase.co
-- ============================================================

-- 1. Criar tabela de pratos
CREATE TABLE IF NOT EXISTS public.pratos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        text NOT NULL,
  descricao   text,
  preco       numeric(10, 2),
  url_foto    text,
  created_at  timestamptz DEFAULT now()
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.pratos ENABLE ROW LEVEL SECURITY;

-- 3. Política: qualquer pessoa pode ler os pratos (cardápio público)
CREATE POLICY "Leitura pública de pratos"
  ON public.pratos FOR SELECT
  USING (true);

-- 4. Política: qualquer pessoa pode inserir pratos (garçom sem login)
CREATE POLICY "Inserção pública de pratos"
  ON public.pratos FOR INSERT
  WITH CHECK (true);

-- 5. Política: qualquer pessoa pode excluir pratos
CREATE POLICY "Exclusão pública de pratos"
  ON public.pratos FOR DELETE
  USING (true);

-- ============================================================
-- STORAGE: O bucket "fotos-pratos" deve ser criado pelo painel:
-- Supabase → Storage → New Bucket → Nome: fotos-pratos → Public: ON
-- ============================================================
