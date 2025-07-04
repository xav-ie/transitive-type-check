import { useEffect } from "react";

export const useNothing = (x: Parameters<typeof useEffect>) => {
  console.log(x);
  return useEffect(() => {});
};

export type { ForwardedRef } from "react";
