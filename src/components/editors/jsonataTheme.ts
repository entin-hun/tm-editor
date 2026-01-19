type ReactLike = {
  createElement: (...args: any[]) => any;
};

const baseStyles = {
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  padding: '10px',
  marginBottom: '10px',
};

const sectionStyles = {
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '6px',
  padding: '8px',
  marginBottom: '8px',
};

function wrap(ReactLib: ReactLike, children: any) {
  return ReactLib.createElement('div', { style: baseStyles }, children);
}

function section(ReactLib: ReactLike, label: string, children: any) {
  return ReactLib.createElement(
    'div',
    { style: sectionStyles },
    ReactLib.createElement(
      'div',
      { style: { fontSize: '12px', opacity: 0.7, marginBottom: '6px' } },
      label
    ),
    children
  );
}

export function createJsonataTheme(ReactLib: ReactLike) {
  const h = ReactLib.createElement;

  const Base = ({ editor, toggleMode, toggleBlock, mode }: any) =>
    wrap(
      ReactLib,
      h(
        'div',
        {},
        h(
          'div',
          { style: { display: 'flex', gap: '8px', marginBottom: '8px' } },
          h(
            'button',
            { onClick: toggleMode, type: 'button' },
            mode === 'NodeMode' ? 'Switch to Text' : 'Switch to Visual'
          ),
          toggleBlock
            ? h(
                'span',
                { style: { fontSize: '12px', color: '#f5a623' } },
                toggleBlock
              )
            : null
        ),
        editor
      )
    );

  const RootNodeEditor = ({ editor }: any) => section(ReactLib, 'Expression', editor);

  const IDETextarea = ({ text, textChange }: any) =>
    h('textarea', {
      value: text || '',
      onChange: (event: any) => textChange(event.target.value),
      style: {
        width: '100%',
        minHeight: '160px',
        background: 'transparent',
        color: 'inherit',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '6px',
        padding: '8px',
      },
    });

  const ComparisonEditor = ({ lhs, rhs, changeOperator, ast }: any) =>
    section(
      ReactLib,
      'Comparison',
      h(
        'div',
        { style: { display: 'grid', gap: '8px' } },
        lhs,
        h(
          'select',
          {
            value: ast?.value || '=',
            onChange: (event: any) => changeOperator(event.target.value),
          },
          ['=', '!=', '>', '<', '>=', '<=', 'in'].map((op) =>
            h('option', { key: op, value: op }, op)
          )
        ),
        rhs
      )
    );

  const CombinerEditor = ({ children, addNew, removeLast }: any) =>
    section(
      ReactLib,
      'Combiner',
      h(
        'div',
        {},
        children,
        h(
          'div',
          { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
          h('button', { onClick: addNew, type: 'button' }, 'Add'),
          h('button', { onClick: removeLast, type: 'button' }, 'Remove')
        )
      )
    );

  const BlockEditor = ({ children }: any) => section(ReactLib, 'Block', children);

  const ConditionEditor = ({ children, elseEditor, addNew, removeLast }: any) =>
    section(
      ReactLib,
      'Condition',
      h(
        'div',
        {},
        children.map((row: any, idx: number) =>
          h(
            'div',
            { key: idx, style: { marginBottom: '8px' } },
            row.Condition,
            row.Then,
            h('button', { onClick: row.remove, type: 'button' }, 'Remove')
          )
        ),
        elseEditor ? h('div', {}, elseEditor) : null,
        h(
          'div',
          { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
          h('button', { onClick: addNew, type: 'button' }, 'Add branch'),
          h('button', { onClick: removeLast, type: 'button' }, 'Remove branch')
        )
      )
    );

  const ObjectUnaryEditor = ({ children, addNew, removeLast }: any) =>
    section(
      ReactLib,
      'Object',
      h(
        'div',
        {},
        children.map((row: any, idx: number) =>
          h(
            'div',
            { key: idx, style: { marginBottom: '8px' } },
            row.key,
            row.value,
            h('button', { onClick: row.remove, type: 'button' }, 'Remove')
          )
        ),
        h(
          'div',
          { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
          h('button', { onClick: addNew, type: 'button' }, 'Add field'),
          h('button', { onClick: removeLast, type: 'button' }, 'Remove field')
        )
      )
    );

  const ArrayUnaryEditor = ({ children, addNew, removeLast }: any) =>
    section(
      ReactLib,
      'Array',
      h(
        'div',
        {},
        children.map((row: any, idx: number) =>
          h(
            'div',
            { key: idx, style: { marginBottom: '8px' } },
            row.editor,
            h('button', { onClick: row.remove, type: 'button' }, 'Remove')
          )
        ),
        h(
          'div',
          { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
          h('button', { onClick: addNew, type: 'button' }, 'Add item'),
          h('button', { onClick: removeLast, type: 'button' }, 'Remove item')
        )
      )
    );

  const ApplyEditor = ({ lhs, children }: any) =>
    section(ReactLib, 'Apply', h('div', {}, lhs, children));

  const FunctionEditor = ({ args, changeProcedure, ast }: any) =>
    section(
      ReactLib,
      'Function',
      h(
        'div',
        {},
        h('input', {
          value: ast?.procedure?.value || '',
          onChange: (event: any) => changeProcedure(event.target.value),
          placeholder: 'Function name',
        }),
        args
      )
    );

  const BindEditor = ({ lhs, rhs }: any) =>
    section(ReactLib, 'Bind', h('div', {}, lhs, rhs));

  const VariableEditor = ({ ast, onChange }: any) =>
    section(
      ReactLib,
      'Variable',
      h('input', {
        value: ast?.value || '',
        onChange: (event: any) => onChange({ ...ast, value: event.target.value }),
      })
    );

  const LeafValueEditor = ({ text, onChangeText }: any) =>
    section(
      ReactLib,
      'Value',
      h('input', {
        value: text || '',
        onChange: (event: any) => onChangeText(event.target.value),
      })
    );

  const PathEditor = ({ ast, onChange }: any) =>
    section(
      ReactLib,
      'Path',
      h('input', {
        value: ast?.value || '',
        onChange: (event: any) => onChange({ ...ast, value: event.target.value }),
      })
    );

  const MathEditor = ({ text, textChange, children }: any) =>
    section(
      ReactLib,
      'Math',
      h('div', {}, IDETextarea({ text, textChange }), children)
    );

  return {
    Base,
    RootNodeEditor,
    IDETextarea,
    ComparisonEditor,
    CombinerEditor,
    BlockEditor,
    ConditionEditor,
    ObjectUnaryEditor,
    ArrayUnaryEditor,
    ApplyEditor,
    FunctionEditor,
    BindEditor,
    VariableEditor,
    LeafValueEditor,
    PathEditor,
    MathEditor,
  };
}
