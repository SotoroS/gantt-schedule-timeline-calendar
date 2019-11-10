/**
 * ChartTimelineGrid component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   GPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

export default function ChartTimelineGrid(vido, props) {
  const { api, state, onDestroy, actions, update, html, reuseComponents } = vido;
  const componentName = 'chart-timeline-grid';
  const componentActions = api.getActions(componentName);

  let wrapper;
  onDestroy(state.subscribe('config.wrappers.ChartTimelineGrid', value => (wrapper = value)));

  const GridRowComponent = state.get('config.components.ChartTimelineGridRow');

  let className;
  onDestroy(
    state.subscribe('config.classNames', () => {
      className = api.getClass(componentName);
      update();
    })
  );

  let height, style;
  onDestroy(
    state.subscribe('_internal.height', h => {
      height = h;
      style = `height: ${height}px`;
      update();
    })
  );

  let period;
  onDestroy(state.subscribe('config.chart.time.period', value => (period = value)));
  let onBlockCreate;
  onDestroy(state.subscribe('config.chart.grid.block.onCreate', onCreate => (onBlockCreate = onCreate)));

  let rowsComponents = [];
  /**
   * Generate blocks
   */
  function generateBlocks() {
    const visibleRows = state.get('_internal.list.visibleRows');
    const periodDates = state.get(`_internal.chart.time.dates.${period}`);
    if (!periodDates || periodDates.length === 0) {
      return;
    }
    let top = 0;
    const rowsWithBlocks = [];
    for (const row of visibleRows) {
      const blocks = [];
      for (const time of periodDates) {
        let id = row.id + ':' + api.time.date(time.leftGlobal).format('YYYY-MM-DD');
        let block = { id, time, row, top };
        for (const onCreate of onBlockCreate) {
          block = onCreate(block);
        }
        blocks.push(block);
      }
      rowsWithBlocks.push({ row, blocks, top });
      top += row.height;
    }
    state.update('_internal.chart.grid.rowsWithBlocks', rowsWithBlocks);
  }
  onDestroy(
    state.subscribeAll(['_internal.list.visibleRows;', `_internal.chart.time.dates.${period};`], generateBlocks, {
      bulk: true
    })
  );

  /**
   * Generate rows components
   * @param {array} rowsWithBlocks
   */
  function generateRowsComponents(rowsWithBlocks) {
    if (rowsWithBlocks) {
      reuseComponents(rowsComponents, rowsWithBlocks, row => row, GridRowComponent);
      update();
    }
  }
  onDestroy(state.subscribe('_internal.chart.grid.rowsWithBlocks', generateRowsComponents));

  /**
   * Bind element
   * @param {Element} element
   */
  function bindElement(element: Element) {
    state.update('_internal.elements.chart-timeline-grid', element);
  }
  if (!componentActions.includes(bindElement)) {
    componentActions.push();
  }

  onDestroy(() => {
    rowsComponents.forEach(row => row.destroy());
  });

  return function updateTemplate(templateProps) {
    return wrapper(
      html`
        <div class=${className} data-actions=${actions(componentActions, { api, state })} style=${style}>
          ${rowsComponents.map(r => r.html())}
        </div>
      `,
      { props, vido, templateProps }
    );
  };
}
