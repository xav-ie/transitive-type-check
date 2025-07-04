import { useNothing, ForwardedRef } from "test-lib";

export type X = ForwardedRef;

export const main = () => {
  return useNothing(12);
};
