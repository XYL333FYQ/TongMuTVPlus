'use client';

import { Check, ChevronDown } from 'lucide-react';
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

import { useAnchoredLayer } from '@/components/feedback/useAnchoredLayer';

// 全站统一的下拉选择。用法与原生 <select> 一致（value / onChange / <option>），
// 但触发器和弹出的列表都是本站自绘的，不出现浏览器原生的下拉样式。
// 列表用 role=listbox，键盘：上下 / Home / End / Enter / Esc / 输入首字母跳转。

interface ParsedOption {
  value: string;
  label: string;
  disabled: boolean;
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean')
    return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node))
    return textOf(
      (node as ReactElement<{ children?: ReactNode }>).props.children
    );
  return '';
}

// 把 <option> 子元素摊平成数组（兼容 map 出来的数组和 Fragment）
function parseOptions(children: ReactNode): ParsedOption[] {
  const result: ParsedOption[] = [];
  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      const element = child as ReactElement<{
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
      }>;
      if (element.type === Fragment) {
        walk(element.props.children);
        return;
      }
      const label = textOf(element.props.children);
      result.push({
        value:
          element.props.value === undefined
            ? label
            : String(element.props.value),
        label,
        disabled: !!element.props.disabled,
      });
    });
  };
  walk(children);
  return result;
}

export interface SelectProps {
  value?: string | number | null;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  title?: string;
  autoFocus?: boolean;
  required?: boolean;
  placeholder?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const NBSP = ' ';

export default function Select({
  value,
  onChange,
  children,
  className,
  disabled,
  id,
  name,
  title,
  autoFocus,
  placeholder,
  required: _required,
  ...aria
}: SelectProps) {
  const options = useMemo(() => parseOptions(children), [children]);
  const current = String(value ?? '');
  const selectedIndex = options.findIndex((option) => option.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', timer: 0 });
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const enabledIndexes = options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((index) => index >= 0);

  const close = useCallback((focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    close(true);
    if (option.value === current) return;
    const target = { value: option.value, name: name ?? '' };
    onChange?.({
      target,
      currentTarget: target,
    } as unknown as ChangeEvent<HTMLSelectElement>);
  };

  const openList = () => {
    if (disabled || !options.length) return;
    if (!triggerRef.current) return;
    setActive(selectedIndex >= 0 ? selectedIndex : enabledIndexes[0] ?? -1);
    setOpen(true);
  };

  // 位置、挂在哪（打开的弹窗里或 body）、在外面按下就关：公共浮层规则；Esc 自己处理（要把焦点还给按钮）
  const { host, style, up, placed } = useAnchoredLayer({
    open,
    anchor: open ? triggerRef.current : null,
    panelRef: listRef,
    onDismiss: () => close(false),
    closeOnEscape: false,
    width: 160,
    matchAnchorWidth: true,
    maxWidth: Infinity,
    maxHeight: 320,
    preferredHeight: options.length * 44 + 12,
  });

  // 打开后把焦点交给列表，才能用键盘操作
  useEffect(() => {
    if (open && placed) listRef.current?.focus({ preventScroll: true });
  }, [open, placed]);

  // 当前项滚动到可见
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index='${active}']`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, placed]);

  const move = (step: 1 | -1) => {
    if (!enabledIndexes.length) return;
    const at = enabledIndexes.indexOf(active);
    const next =
      at < 0
        ? step === 1
          ? 0
          : enabledIndexes.length - 1
        : (at + step + enabledIndexes.length) % enabledIndexes.length;
    setActive(enabledIndexes[next]);
  };

  const onListKeyDown = (event: ReactKeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        return;
      case 'Home':
        event.preventDefault();
        setActive(enabledIndexes[0] ?? -1);
        return;
      case 'End':
        event.preventDefault();
        setActive(enabledIndexes[enabledIndexes.length - 1] ?? -1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (active >= 0) choose(active);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case 'Tab':
        close(false);
        return;
    }
    // 输入字母跳到对应项
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      window.clearTimeout(typeahead.current.timer);
      typeahead.current.text += event.key.toLowerCase();
      typeahead.current.timer = window.setTimeout(() => {
        typeahead.current.text = '';
      }, 600);
      const hit = options.findIndex(
        (option) =>
          !option.disabled &&
          option.label.toLowerCase().startsWith(typeahead.current.text)
      );
      if (hit >= 0) setActive(hit);
    }
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  };

  const label = selected?.label ?? placeholder ?? '';

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        id={id}
        title={title}
        disabled={disabled}
        autoFocus={autoFocus}
        role='combobox'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        data-tm-select=''
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        className={cn('tm-select-trigger', className)}
        {...aria}
      >
        <span
          className='tm-select-value'
          data-placeholder={selected ? undefined : ''}
        >
          {label || NBSP}
        </span>
        <ChevronDown className='tm-select-caret' aria-hidden='true' />
      </button>
      {name ? <input type='hidden' name={name} value={current} /> : null}
      {open && host
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role='listbox'
              tabIndex={-1}
              aria-label={aria['aria-label'] || title}
              aria-activedescendant={
                active >= 0 ? `${listId}-${active}` : undefined
              }
              className='tm-select-menu'
              // 挂进打开的弹窗时是“客人”，弹窗层的款式规则不把它当面板
              data-tm-layer-guest=''
              data-up={up ? '' : undefined}
              style={style}
              onKeyDown={onListKeyDown}
            >
              {options.map((option, index) => (
                <div
                  key={`${option.value}-${index}`}
                  id={`${listId}-${index}`}
                  role='option'
                  data-index={index}
                  aria-selected={index === selectedIndex}
                  aria-disabled={option.disabled || undefined}
                  data-active={index === active ? '' : undefined}
                  className='tm-select-option'
                  onPointerEnter={() => !option.disabled && setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span>{option.label || NBSP}</span>
                  {index === selectedIndex ? (
                    <Check size={16} strokeWidth={2.4} aria-hidden='true' />
                  ) : null}
                </div>
              ))}
            </div>,
            host
          )
        : null}
    </>
  );
}
