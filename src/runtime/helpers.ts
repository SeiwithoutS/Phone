export function getRandomValue(options: string): string {
  if (!options.includes(',')) return options
  const values = options.split(',').map(value => value.trim())
  return values[Math.floor(Math.random() * values.length)]
}

export function debounce<Context, Args extends unknown[]>(
  callback: (this: Context, ...args: Args) => void,
  delay: number,
) {
  let timer: ReturnType<typeof setTimeout>
  return function (this: Context, ...args: Args) {
    clearTimeout(timer)
    timer = setTimeout(() => callback.apply(this, args), delay)
  }
}
