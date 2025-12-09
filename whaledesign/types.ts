export interface Position {
  x: number;
  y: number;
}

export interface Accessory {
  id: string;
  name: string;
  src: string; // URL or Base64
  x: number;
  y: number;
  scale: number;
  rotation: number;
  isFlipped: boolean;
  zIndex: number;
}

export interface GeneratedAsset {
  data: string;
  mimeType: string;
}

export interface WhaleState {
    baseImage: string;
    hueRotation: number;
}

export enum ToolMode {
  MOVE = 'MOVE',
  DELETE = 'DELETE',
  RESIZE = 'RESIZE'
}