import { useApp } from '../../store/useApp';
import { Modal } from './Modal';

export function ConfirmDialog() {
  const confirm = useApp((state) => state.confirm);
  const close = useApp((state) => state.closeConfirm);

  return (
    <Modal
      open={Boolean(confirm)}
      onClose={close}
      title={confirm?.title ?? 'Confirm'}
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className={confirm?.danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => {
              confirm?.onConfirm();
              close();
            }}
          >
            {confirm?.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-ink-muted">{confirm?.body}</p>
    </Modal>
  );
}
