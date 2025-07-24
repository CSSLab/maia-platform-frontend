interface Props {
  min?: number
  max?: number
  value?: number
  label?: string
}

export const VerticalEvaluationBar: React.FC<Props> = ({
  min = 0,
  max = 1,
  value,
  label,
}: Props) => {
  const height = (((value ?? min) - min) / (max - min)) * 100

  return (
    <div className="relative flex h-[75vh] max-h-[75vw] w-6 flex-col justify-end overflow-hidden rounded-sm bg-human-3/30">
      <p className="z-10 mb-3 -rotate-90 whitespace-nowrap text-xs">{label}</p>
      <div
        className="absolute bottom-0 left-0 z-0 h-full w-full transform rounded-t-sm bg-human-3 duration-300"
        style={{ height: `${height}%` }}
      />
    </div>
  )
}
