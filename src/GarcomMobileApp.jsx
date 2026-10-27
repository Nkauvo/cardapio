import React, { useState, useEffect, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabaseClient';

// Detecta se está rodando dentro do app nativo (Android/iOS)
const isNative = Capacitor.isNativePlatform();

/**
 * GarcomMobileApp
 *
 * Fluxo completo:
 *  1. Garçom tira foto (câmera ou galeria) via Capacitor (nativo) ou <input file> (web)
 *  2. Foto é enviada ao Supabase Storage (bucket: fotos-pratos)
 *  3. Dados do prato (nome, descrição, preço, url_foto) salvos na tabela `pratos`
 *  4. Lista de pratos cadastrados é exibida abaixo do formulário
 */
export default function GarcomMobileApp() {
  // ── Estado do formulário ──
  const [fotoPrato, setFotoPrato] = useState(null);     // URL local (preview)
  const [fotoBlob, setFotoBlob] = useState(null);       // Blob para upload
  const [nomePrato, setNomePrato] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');

  // ── Estado da UI ──
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  // ── Lista de pratos do banco ──
  const [pratos, setPratos] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);

  // ── Ref para o input file oculto (fallback web) ──
  const inputFileRef = useRef(null);

  // ── Busca pratos ao montar o componente ──
  useEffect(() => {
    buscarPratos();
  }, []);

  /**
   * Busca todos os pratos cadastrados no Supabase, ordenados do mais novo.
   */
  const buscarPratos = async () => {
    setCarregandoLista(true);
    const { data, error } = await supabase
      .from('pratos')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setPratos(data || []);
    setCarregandoLista(false);
  };

  /**
   * Abre câmera/galeria.
   * - No Android/iOS: usa Capacitor Camera
   * - No navegador web: abre <input type="file"> nativo do browser
   */
  const cadastrarFotoPrato = async () => {
    setErro(null);
    setSucesso(null);

    if (isNative) {
      // ── Fluxo nativo (Android/iOS) ──
      setCarregando(true);
      try {
        const permissoes = await Camera.checkPermissions();
        if (permissoes.camera !== 'granted' || permissoes.photos !== 'granted') {
          const resultado = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
          if (resultado.camera !== 'granted' && resultado.photos !== 'granted') {
            setErro('Permissão negada. Habilite a câmera nas configurações do dispositivo.');
            setCarregando(false);
            return;
          }
        }

        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt,
        });

        if (image?.webPath) {
          setFotoPrato(image.webPath);
          // Converte webPath em Blob
          const resp = await fetch(image.webPath);
          const blob = await resp.blob();
          setFotoBlob(blob);
        }
      } catch (error) {
        const msg = error?.message || String(error);
        if (!msg.includes('cancelled') && !msg.includes('canceled') && !msg.includes('dismissed') && !msg.includes('No image picked')) {
          setErro('Não foi possível acessar a câmera. Tente novamente.');
        }
      } finally {
        setCarregando(false);
      }
    } else {
      // ── Fluxo web (navegador do PC/celular) ──
      // Dispara o <input type="file"> oculto
      inputFileRef.current?.click();
    }
  };

  /**
   * Callback do <input type="file"> — usado apenas no navegador web.
   */
  const onFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setFotoPrato(previewUrl);
    setFotoBlob(file);

    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  /**
   * Salva o prato: faz upload da foto no Storage e insere registro na tabela `pratos`.
   */
  const salvarPrato = async () => {
    if (!nomePrato.trim()) { setErro('Informe o nome do prato.'); return; }
    if (!fotoBlob) { setErro('Adicione uma foto do prato antes de salvar.'); return; }

    setErro(null);
    setSucesso(null);
    setSalvando(true);

    try {
      const extensao = fotoBlob.type?.includes('png') ? 'png' : 'jpg';
      const nomeArquivo = `prato_${Date.now()}.${extensao}`;

      // 1. Upload da foto no Supabase Storage (bucket: fotos-pratos)
      const { error: uploadError } = await supabase.storage
        .from('fotos-pratos')
        .upload(nomeArquivo, fotoBlob, {
          contentType: fotoBlob.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw new Error(`Erro no upload da foto: ${uploadError.message}`);

      // 2. Obter URL pública da foto
      const { data: urlData } = supabase.storage
        .from('fotos-pratos')
        .getPublicUrl(nomeArquivo);

      const urlFoto = urlData?.publicUrl || null;

      // 3. Inserir prato na tabela `pratos`
      const { error: insertError } = await supabase
        .from('pratos')
        .insert([{
          nome: nomePrato.trim(),
          descricao: descricao.trim() || null,
          preco: preco ? parseFloat(preco) : null,
          url_foto: urlFoto,
        }]);

      if (insertError) throw new Error(`Erro ao salvar prato: ${insertError.message}`);

      // 4. Sucesso — limpa formulário e atualiza lista
      setSucesso(`✅ Prato "${nomePrato}" cadastrado com sucesso!`);
      setNomePrato('');
      setDescricao('');
      setPreco('');
      setFotoPrato(null);
      setFotoBlob(null);
      await buscarPratos();

      setTimeout(() => setSucesso(null), 4000);
    } catch (error) {
      console.error('[Supabase] Erro ao salvar prato:', error);
      setErro(error.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  /**
   * Exclui um prato do banco e sua foto do Storage.
   */
  const excluirPrato = async (prato) => {
    if (!confirm(`Excluir "${prato.nome}"?`)) return;

    if (prato.url_foto) {
      const nomeArquivo = prato.url_foto.split('/').pop();
      await supabase.storage.from('fotos-pratos').remove([nomeArquivo]);
    }

    const { error } = await supabase.from('pratos').delete().eq('id', prato.id);
    if (!error) await buscarPratos();
  };

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">

      {/* Input file oculto — fallback para navegador web */}
      <input
        ref={inputFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileSelected}
        className="hidden"
      />

      {/* ─── Cabeçalho ─── */}
      <header className="bg-amber-900 text-white px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍽️</span>
          <div>
            <h1 className="text-xl font-bold tracking-wide">Cardápio do Chef</h1>
            <p className="text-amber-200 text-xs">Gestão de Pratos Especiais</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">

        {/* ─── Card Cadastro ─── */}
        <div className="bg-white rounded-2xl shadow-md border border-amber-100 overflow-hidden">
          <div className="bg-amber-800 px-5 py-3">
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <span>⭐</span> Cadastrar Prato Especial
            </h2>
          </div>

          <div className="p-5 space-y-4">

            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Prato *</label>
              <input
                type="text"
                value={nomePrato}
                onChange={(e) => setNomePrato(e.target.value)}
                placeholder="Ex: Risoto de Cogumelos Trufados"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ingredientes e modo de preparo..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50 resize-none"
              />
            </div>

            {/* Preço */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Preço</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                <input
                  type="number"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="0,00"
                  min="0"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50"
                />
              </div>
            </div>

            {/* Foto */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Foto do Prato *</label>
              {fotoPrato ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={fotoPrato} alt="Prato" className="w-full h-52 object-cover" />
                  <div className="absolute inset-0 flex items-end justify-between p-3">
                    <button
                      onClick={() => { setFotoPrato(null); setFotoBlob(null); }}
                      className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow hover:bg-red-700"
                    >
                      🗑️ Remover
                    </button>
                    <button
                      onClick={cadastrarFotoPrato}
                      disabled={carregando}
                      className="bg-amber-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow hover:bg-amber-900 disabled:opacity-60"
                    >
                      📷 Trocar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-amber-300 rounded-xl bg-amber-50 h-44 flex flex-col items-center justify-center gap-2">
                  <span className="text-5xl">📷</span>
                  <p className="text-slate-400 text-sm">Nenhuma foto adicionada</p>
                </div>
              )}
            </div>

            {/* Botão câmera */}
            <button
              onClick={cadastrarFotoPrato}
              disabled={carregando || salvando}
              className="w-full bg-amber-800 hover:bg-amber-900 active:scale-95 disabled:opacity-60 text-white font-bold py-3.5 px-5 rounded-xl flex items-center justify-center gap-3 transition-all shadow-md"
            >
              {carregando
                ? <><span className="animate-spin">⏳</span> Abrindo câmera...</>
                : <><span className="text-xl">📸</span> {fotoPrato ? 'Trocar Foto / Galeria' : 'Tirar Foto / Galeria'}</>
              }
            </button>

            {/* Feedback erro */}
            {erro && (
              <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                <span>⚠️</span><span>{erro}</span>
              </div>
            )}

            {/* Feedback sucesso */}
            {sucesso && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm font-medium">
                <span>{sucesso}</span>
              </div>
            )}

            {/* Botão salvar no Supabase */}
            <button
              onClick={salvarPrato}
              disabled={salvando || carregando || !fotoBlob || !nomePrato.trim()}
              className="w-full bg-green-700 hover:bg-green-800 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-5 rounded-xl flex items-center justify-center gap-2 transition-all shadow"
            >
              {salvando
                ? <><span className="animate-spin">⏳</span> Salvando no banco...</>
                : <><span>💾</span> Salvar Prato no Supabase</>
              }
            </button>

          </div>
        </div>

        {/* ─── Lista de Pratos Cadastrados ─── */}
        <div className="bg-white rounded-2xl shadow-md border border-amber-100 overflow-hidden">
          <div className="bg-amber-800 px-5 py-3 flex items-center justify-between">
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <span>📋</span> Pratos Cadastrados
            </h2>
            <button
              onClick={buscarPratos}
              className="text-amber-200 hover:text-white text-xs underline"
            >
              Atualizar
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {carregandoLista ? (
              <div className="py-10 text-center text-slate-400 text-sm">Carregando pratos...</div>
            ) : pratos.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                <p className="text-3xl mb-2">🍴</p>
                Nenhum prato cadastrado ainda.
              </div>
            ) : (
              pratos.map((prato) => (
                <div key={prato.id} className="flex gap-3 p-4 items-start">
                  {/* Foto */}
                  {prato.url_foto ? (
                    <img
                      src={prato.url_foto}
                      alt={prato.nome}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-amber-100 flex items-center justify-center text-3xl flex-shrink-0">
                      🍽️
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{prato.nome}</p>
                    {prato.descricao && (
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{prato.descricao}</p>
                    )}
                    {prato.preco && (
                      <p className="text-green-700 font-bold text-sm mt-1">
                        R$ {Number(prato.preco).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Excluir */}
                  <button
                    onClick={() => excluirPrato(prato)}
                    className="text-red-400 hover:text-red-600 text-lg flex-shrink-0"
                    title="Excluir prato"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 px-4 pb-4">
          💡 Fotos salvas no Supabase Storage · Dados na tabela <code>pratos</code>
        </p>

      </main>
    </div>
  );
}
