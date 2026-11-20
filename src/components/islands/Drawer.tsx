// Backwards-compatible alias: every existing modal/drawer now renders through the portal-based Modal.
import Modal from './Modal';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
  size?: 'md' | 'lg' | 'xl';
}

export default function Drawer(props: Props) {
  return <Modal {...props} />;
}
