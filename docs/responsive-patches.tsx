// ============================================================
// responsive-patches.tsx
// Patches de responsividade para todos os componentes
// Aplique as classes/padrões descritos nos seus componentes
// ============================================================

// ─── 1. LAYOUT DASHBOARD ─────────────────────────────────────
//
// Em: app/dashboard/layout.tsx
// Substituir a div principal do shell por:
//
// <div className="flex h-[100dvh] overflow-hidden bg-zinc-50 dark:bg-zinc-950">
//   ↑ usar 100dvh no lugar de h-screen para respeitar a barra do browser mobile
//
// No <main>:
// <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
//   ↑ padding cresce progressivamente

// ─── 2. HEADER ───────────────────────────────────────────────
//
// Garantir altura mínima de 56px para área tocável no header:
// <header className="h-14 min-h-[56px] px-3 sm:px-4 ...">
//
// Botão hamburguer com área de toque maior:
// <button className="lg:hidden -ml-1 p-2 rounded-lg ...">
//   ↑ padding extra expande área sem mudar visual

// ─── 3. CARDS LC / BRANDY ────────────────────────────────────
//
// Grid de campos — 1 col mobile, 2 col sm+:
// <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 sm:gap-y-4">
//
// Campo sangria/dinheiro (full-width em qualquer tela):
// <div className="col-span-1 sm:col-span-2">

// ─── 4. CURRENCY INPUT ───────────────────────────────────────
//
// Altura maior em mobile para fácil toque:
// <div className="h-12 sm:h-11 ...">
//
// font-size mínimo de 16px previne zoom no iOS:
// <input className="text-base sm:text-sm ...">

// ─── 5. CARD RESULTADO ───────────────────────────────────────
//
// Toggle +/- em coluna no mobile:
// <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 ...">
//
// Botões do toggle com largura total em mobile:
// <div className="flex w-full xs:w-auto ...">
//   <button className="flex-1 xs:flex-none px-3 h-9 ...">

// ─── 6. PÁGINA HISTÓRICO ─────────────────────────────────────
//
// Toolbar: busca + filtros em coluna no mobile:
// <div className="flex flex-col gap-3">
//   <div className="relative w-full"> ← busca sempre full width
//   <div className="flex overflow-x-auto gap-1 pb-0.5"> ← filtros com scroll
//     (usar overflow-x: auto para não quebrar em telas pequenas)
//
// Filtros não devem quebrar linha — usar overflow-x auto:
// <div className="flex items-center gap-1 bg-zinc-100 ... overflow-x-auto scrollbar-none">
//   <button className="shrink-0 ..."> ← shrink-0 impede compressão

// ─── 7. TABELA → CARDS ───────────────────────────────────────
//
// Padrão correto (já implementado, reforçar):
// <div className="hidden sm:block"> ← tabela só sm+
// <div className="sm:hidden space-y-3"> ← cards só mobile
//
// NUNCA usar tabela sem wrapper de scroll:
// <div className="overflow-x-auto -mx-4 sm:mx-0">
//   <table className="min-w-[480px] w-full">

// ─── 8. MODAL ────────────────────────────────────────────────
//
// Sheet mobile (sobe da base) + centered desktop:
// <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
//   <div className="
//     w-full sm:max-w-2xl
//     max-h-[92dvh] sm:max-h-[88vh]
//     rounded-t-2xl sm:rounded-2xl
//   ">
//
// Handle visual para o sheet mobile:
// <div className="sm:hidden flex justify-center pt-3 pb-1 cursor-grab">
//   <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
// </div>

// ─── 9. TOAST ────────────────────────────────────────────────
//
// Full-width no mobile, fixo à direita no desktop:
// <div className="fixed bottom-0 sm:bottom-5 left-0 sm:left-auto right-0 sm:right-5
//                 z-50 p-4 sm:p-0 sm:w-full sm:max-w-sm">

// ─── 10. IMPRESSÃO TÉRMICA ───────────────────────────────────
//
// Scroll horizontal para o preview do cupom em telas estreitas:
// <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
//   <div className="inline-block min-w-[220px]">

// ─── 11. CAMPO OBSERVAÇÕES ───────────────────────────────────
//
// Chips com wrap natural (já está correto):
// <div className="flex flex-wrap gap-1.5">
//
// Textarea com rows menores em mobile:
// <textarea rows={4} className="sm:rows-5 ...">  ← via JS: rows={isMobile ? 4 : 5}

// ─── 12. BOTÃO DE SUBMIT / AÇÕES ─────────────────────────────
//
// Full-width mobile, auto desktop:
// <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center
//                 justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
//   <button className="w-full sm:w-auto ...">Cancelar</button>
//   <button className="w-full sm:w-auto ...">Salvar</button>

export {}