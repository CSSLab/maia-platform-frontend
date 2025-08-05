import React from 'react'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  id?: string
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  id,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-primary">
          {label}
        </label>
        <span className="text-sm text-secondary">
          {value}
          {unit}
        </span>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-background-3 outline-none"
          style={{
            background: `linear-gradient(to right, rgb(var(--color-human-accent4)) 0%, rgb(var(--color-human-accent4)) ${
              ((value - min) / (max - min)) * 100
            }%, rgb(var(--color-background3)) ${
              ((value - min) / (max - min)) * 100
            }%, rgb(var(--color-background3)) 100%)`,
          }}
        />
        <style jsx>{`
          input[type='range']::-webkit-slider-thumb {
            appearance: none;
            height: 18px;
            width: 18px;
            border-radius: 50%;
            background: rgb(var(--color-human-accent4));
            cursor: pointer;
            border: 2px solid rgb(var(--color-background1));
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          input[type='range']::-moz-range-thumb {
            height: 18px;
            width: 18px;
            border-radius: 50%;
            background: rgb(var(--color-human-accent4));
            cursor: pointer;
            border: 2px solid rgb(var(--color-background1));
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
        `}</style>
      </div>
    </div>
  )
}
