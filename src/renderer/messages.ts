/** Turns errors (including ones passed through from the main process) into a short plain sentence. */
export function plainError(e: unknown): string {
  let msg = e instanceof Error ? e.message : String(e);
  msg = msg.replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^(\w*Error):\s*/, '');
  const code = /\b(ENOENT|EACCES|EPERM|ENOTDIR|EEXIST|ENOSPC|EBUSY)\b/.exec(msg)?.[1];
  switch (code) {
    case 'ENOENT':
      return "the file or folder isn't there";
    case 'EACCES':
    case 'EPERM':
      return "Windows didn't allow it";
    case 'ENOTDIR':
    case 'EEXIST':
      return "that folder can't be used";
    case 'ENOSPC':
      return 'the disk is full';
    case 'EBUSY':
      return 'another program is using the file';
    default:
      return msg;
  }
}

type Listener = (title: string, text: string) => void;
let listener: Listener | null = null;

/** Shows a message dialog (App registers the handler). */
export function showMessage(title: string, text: string): void {
  listener?.(title, text);
}

export function onMessage(l: Listener | null): void {
  listener = l;
}
