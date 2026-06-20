export type TVncClientAction = 'copy' | 'deeplink';

export type TVncClientOption = {
  action: TVncClientAction;
  hint?: string;
  id: string;
  label: string;
};

export const formatVncAddress = (port: number) => `localhost:${port}`;

export const formatVncDeeplink = (port: number) => `vnc://${formatVncAddress(port)}`;

export const VNC_CLIENT_OPTIONS: TVncClientOption[] = [
  {
    action: 'deeplink',
    id: 'screen-sharing',
    label: 'macOS Screen Sharing',
  },
  {
    action: 'deeplink',
    id: 'realvnc',
    label: 'RealVNC Viewer',
  },
  {
    action: 'copy',
    hint: 'Paste into TigerVNC → File → New Connection',
    id: 'tigervnc',
    label: 'TigerVNC',
  },
  {
    action: 'copy',
    id: 'copy-address',
    label: 'Copy address',
  },
];

export const copyVncAddress = async (port: number) => {
  const value = formatVncAddress(port);

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};
