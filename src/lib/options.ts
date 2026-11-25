/** A choice for SelectField, with a line on what it does */
export interface Option<T extends string> {
  value: T
  label: string
  hint: string
}
