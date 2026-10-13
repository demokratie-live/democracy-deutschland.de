import type { ReactNode } from "react";

/**
 * Bootstrap modal markup of donate_details.tpl (`.modal.fade`, centered,
 * large); `children` is the body after the close button. Opened by a
 * <ModalToggle target="#id">.
 */
export function Modal({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div
      className="modal fade"
      id={id}
      tabIndex={-1}
      role="dialog"
      aria-labelledby={label}
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div className="modal-content" style={{ padding: "5px" }}>
          <div className="modal-body" style={{ textAlign: "left" }}>
            <button type="button" className="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
