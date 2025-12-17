/// <reference types="vite/client" />

// Allow importing PNG images
declare module '*.png' {
  const content: string;
  export default content;
}

// Allow importing other image formats
declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}
