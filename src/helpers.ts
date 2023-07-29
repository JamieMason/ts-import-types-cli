/** Reads input from stdin */
export async function readStdin() {
  let data = ''
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data;
}
