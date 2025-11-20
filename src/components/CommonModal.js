import React from "react";
import { createPortal } from "react-dom";
import "./CommonModal.css";

export default function CommonModal({ isOpen, onClose, title, icon, children, emptyMessage }) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="common-modal-overlay"
      onClick={onClose}
    >
      <div
        className="common-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="common-modal-title">
          {icon && <span>{icon}</span>}
          <span>{title}</span>
        </h3>
        {children ? (
          children
        ) : emptyMessage ? (
          <div className="common-modal-empty">
            {emptyMessage}
          </div>
        ) : null}
        <div className="common-modal-close-container">
          <button
            onClick={onClose}
            className="common-modal-close-button"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

