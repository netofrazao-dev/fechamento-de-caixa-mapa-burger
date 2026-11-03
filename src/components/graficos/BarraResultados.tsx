interface Props {
  fechou: number
  sobrou: number
  faltou: number
}

const PARTES = [
  { chave: 'fechou', rotulo: 'Fechou certinho', cor: 'bg-green-600 dark:bg-green-500', texto: 'text-green-700 dark:text-green-400', icone: '✓' },
  { chave: 'sobrou', rotulo: 'Sobrou', cor: 'bg-blue-600 dark:bg-blue-500', texto: 'text-blue-700 dark:text-blue-400', icone: '+' },
  { chave: 'faltou', rotulo: 'Faltou', cor: 'bg-red-600 dark:bg-red-500', texto: 'text-red-700 dark:text-red-400', icone: '−' },
] as const

/** Barra única dividida: quantos dias fecharam, sobraram e faltaram (cor + ícone + texto). */
export default function BarraResultados(props: Props) {
  const total = props.fechou + props.sobrou + props.faltou
  if (!total) return null
  return (
    <figure aria-label={`Resultado dos dias: ${props.fechou} fecharam, ${props.sobrou} sobrou, ${props.faltou} faltou`} className="space-y-2">
      <div className="flex h-3.5 gap-[2px] rounded-[4px] overflow-hidden">
        {PARTES.map((p) =>
          props[p.chave] > 0 ? <div key={p.chave} className={p.cor} style={{ flexGrow: props[p.chave], flexBasis: 0 }} /> : null,
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {PARTES.map((p) => (
          <div key={p.chave}>
            <p className={`text-lg font-bold tabular-nums ${p.texto}`}>
              <span aria-hidden className="mr-0.5 text-sm">{p.icone}</span>
              {props[p.chave]}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{p.rotulo}</p>
          </div>
        ))}
      </div>
    </figure>
  )
}
