/**
 * ChartTimelineItems component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   GPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

export default function ChartTimelineItems(vido, props = {}) {
  const { api, state, onDestroy, actions, update, html, reuseComponents } = vido;
  const componentName = 'chart-timeline-items';
  const componentActions = api.getActions(componentName);
  let wrapper;
  onDestroy(state.subscribe('config.wrappers.ChartTimelineItems', value => (wrapper = value)));

  const ItemsRowComponent = state.get('config.components.ChartTimelineItemsRow');

  let className;
  onDestroy(
    state.subscribe('config.classNames', () => {
      className = api.getClass(componentName);
      update();
    })
  );

  let rowsComponents = [];
  function createRowComponents() {
    const visibleRows = state.get('_internal.list.visibleRows');
    rowsComponents = reuseComponents(rowsComponents, visibleRows, row => ({ row }), ItemsRowComponent);
    update();
  }
  onDestroy(
    state.subscribeAll(['_internal.list.visibleRows', 'config.chart.items', 'config.list.rows'], createRowComponents, {
      bulk: true
    })
  );

  onDestroy(() => {
    rowsComponents.forEach(row => row.destroy());
  });

  return templateProps =>
    wrapper(
      html`
        <div class=${className} data-actions=${actions(componentActions, { api, state })}>
          ${rowsComponents.map(r => r.html())}
        </div>
      `,
      { props, vido, templateProps }
    );
}
