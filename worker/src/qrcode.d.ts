declare module 'qrcode' {
  type TQrToDataUrlOptions = {
    margin?: number;
    width?: number;
  };

  const QRCode: {
    toDataURL: (text: string, options?: TQrToDataUrlOptions) => Promise<string>;
  };

  export default QRCode;
}
