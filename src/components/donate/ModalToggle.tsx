"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { disposeModal, toggleModal } from "@/lib/bootstrap-modal";

/** `<input type="button" data-toggle="modal" data-target="#id">` (Bootstrap data API). */
export function ModalToggle({
  target,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { target: string }) {
  const modal = useRef<HTMLElement | null>(null);
  useEffect(
    () => () => {
      if (modal.current) disposeModal(modal.current);
    },
    [],
  );
  return (
    <input
      {...props}
      type="button"
      data-toggle="modal"
      data-target={target}
      onClick={(event) => {
        modal.current = document.querySelector<HTMLElement>(target);
        toggleModal(target, event.currentTarget);
      }}
    />
  );
}
