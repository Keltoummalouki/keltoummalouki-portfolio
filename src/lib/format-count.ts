// Shared by server-rendered numbers and the client count-up animations, so the
// animation always lands on exactly the string the server rendered.
const countFormat = new Intl.NumberFormat('en-GB')

export const formatCount = (value: number) => countFormat.format(value)
