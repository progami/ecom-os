declare module 'bcryptjs' {
  export function hash(data: string, salt: number): Promise<string>
  export function hashSync(data: string, salt: number): string
  export function compare(data: string, encrypted: string): Promise<boolean>
  export function compareSync(data: string, encrypted: string): boolean
}

