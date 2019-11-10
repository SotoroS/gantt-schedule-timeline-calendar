/**
 * ItemHold plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   GPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

function ItemHold(options = {}) {
  const defaultOptions = {
    time: 1000,
    movementThreshold: 2,
    action(element, data) {}
  };
  options = { ...defaultOptions, ...options };

  const holding = {};
  const mouse = { x: 0, y: 0 };

  function onMouseDown(item, element, event) {
    if (typeof holding[item.id] === 'undefined') {
      holding[item.id] = { x: event.x, y: event.y };
      setTimeout(() => {
        if (typeof holding[item.id] !== 'undefined') {
          let exec = true;
          let xMovement = holding[item.id].x - mouse.x;
          if (Math.sign(xMovement) === -1) {
            xMovement = -xMovement;
          }
          let yMovement = holding[item.id].y - mouse.y;
          if (Math.sign(yMovement) === -1) {
            yMovement = -yMovement;
          }
          if (xMovement > options.movementThreshold) {
            exec = false;
          }
          if (yMovement > options.movementThreshold) {
            exec = false;
          }
          delete holding[item.id];
          if (exec) {
            options.action(element, item);
          }
        }
      }, options.time);
    }
  }

  function onMouseUp(itemId) {
    if (typeof holding[itemId] !== 'undefined') {
      delete holding[itemId];
    }
  }

  function action(element, data) {
    function elementMouseDown(event) {
      onMouseDown(data.item, element, event);
    }
    element.addEventListener('mousedown', elementMouseDown);
    function mouseUp() {
      onMouseUp(data.item.id);
    }

    document.addEventListener('mouseup', mouseUp);
    function onMouseMove(event) {
      mouse.x = event.x;
      mouse.y = event.y;
    }

    document.addEventListener('mousemove', onMouseMove);
    return {
      update(element, changedData) {
        data = changedData;
      },
      destroy(element, data) {
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mousemove', onMouseMove);
        element.removeEventListener('mousedown', elementMouseDown);
      }
    };
  }

  return function initialize(vido) {
    vido.state.update('config.actions.chart-timeline-items-row-item', actions => {
      actions.push(action);
      return actions;
    });
  };
}

/**
 * ItemMovement plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   GPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

function ItemMovement(options = {}) {
  const defaultOptions = {
    moveable: true,
    resizeable: true,
    resizerContent: '',
    collisionDetection: true,
    outOfBorders: false,
    snapStart: (timeStart, startDiff) => timeStart + startDiff,
    snapEnd: (timeEnd, endDiff) => timeEnd + endDiff,
    ghostNode: true
  };
  options = { ...defaultOptions, ...options };

  const movementState = {};

  /**
   * Add moving functionality to items as action
   *
   * @param {Node} node DOM Node
   * @param {Object} data
   */
  function action(node, data) {
    // @ts-ignore
    let element = node.querySelector('.gantt-schedule-timeline-calendar__chart-timeline-items-row-item-content');
    if (!options.moveable && !options.resizeable) {
      return;
    }
    let state;
    let api;

    function isMoveable(data) {
      let moveable = options.moveable;
      if (data.item.hasOwnProperty('moveable') && moveable) {
        moveable = data.item.moveable;
      }
      if (data.row.hasOwnProperty('moveable') && moveable) {
        moveable = data.row.moveable;
      }
      return moveable;
    }

    function isResizeable(data) {
      let resizeable = options.resizeable && (!data.item.hasOwnProperty('resizeable') || data.item.resizeable === true);
      if (data.row.hasOwnProperty('resizeable') && resizeable) {
        resizeable = data.row.resizeable;
      }
      return resizeable;
    }

    function getMovement(data) {
      const itemId = data.item.id;
      if (typeof movementState[itemId] === 'undefined') {
        movementState[itemId] = { moving: false, resizing: false };
      }
      return movementState[itemId];
    }

    function createGhost(data, ev, ganttLeft, ganttTop) {
      const movement = getMovement(data);
      if (!options.ghostNode || typeof movement.ghost !== 'undefined') {
        return;
      }
      const ghost = element.cloneNode(true);
      const style = getComputedStyle(element);
      ghost.style.position = 'absolute';
      ghost.style.left = ev.x - ganttLeft - movement.itemLeftCompensation + 'px';
      const itemTop = ev.y - ganttTop - data.row.top - element.offsetTop;
      movement.itemTop = itemTop;
      ghost.style.top = ev.y - ganttTop - itemTop + 'px';
      ghost.style.width = style.width;
      ghost.style['box-shadow'] = '10px 10px 6px #00000020';
      const height = element.clientHeight + 'px';
      ghost.style.height = height;
      ghost.style['line-height'] = height;
      ghost.style.opacity = '0.75';
      state.get('_internal.elements.chart-timeline').appendChild(ghost);
      movement.ghost = ghost;
      return ghost;
    }

    function moveGhost(data, ev) {
      if (options.ghostNode) {
        const movement = getMovement(data);
        const left = ev.x - movement.ganttLeft - movement.itemLeftCompensation;
        const compensation = state.get('config.scroll.compensation');
        movement.ghost.style.left = left + 'px';
        movement.ghost.style.top = ev.y - movement.ganttTop - movement.itemTop + compensation + 'px';
      }
    }

    function destroyGhost(itemId) {
      if (!options.ghostNode) {
        return;
      }
      if (typeof movementState[itemId] !== 'undefined' && typeof movementState[itemId].ghost !== 'undefined') {
        state.get('_internal.elements.chart-timeline').removeChild(movementState[itemId].ghost);
        delete movementState[itemId].ghost;
      }
      element.style.opacity = '1';
    }

    function getSnapStart(data) {
      let snapStart = options.snapStart;
      if (typeof data.item.snapStart === 'function') {
        snapStart = data.item.snapStart;
      }
      return snapStart;
    }

    function getSnapEnd(data) {
      let snapEnd = options.snapEnd;
      if (typeof data.item.snapEnd === 'function') {
        snapEnd = data.item.snapEnd;
      }
      return snapEnd;
    }

    state = data.state;
    api = data.api;

    const resizerHTML = `<div class="${api.getClass('chart-timeline-items-row-item-content-resizer')}">${
      options.resizerContent
    }</div>`;
    // @ts-ignore
    element.insertAdjacentHTML('beforeend', resizerHTML);
    const resizerEl = element.querySelector(
      '.gantt-schedule-timeline-calendar__chart-timeline-items-row-item-content-resizer'
    );
    if (!isResizeable(data)) {
      resizerEl.style.visibility = 'hidden';
    } else {
      resizerEl.style.visibility = 'visible';
    }

    function labelMouseDown(ev) {
      ev.stopPropagation();
      if (ev.button !== 0) {
        return;
      }
      // @ts-ignore
      element = node.querySelector('.gantt-schedule-timeline-calendar__chart-timeline-items-row-item-content');
      const movement = getMovement(data);
      movement.moving = true;
      const item = state.get(`config.chart.items.${data.item.id}`);
      const chartLeftTime = state.get('_internal.chart.time.leftGlobal');
      const timePerPixel = state.get('_internal.chart.time.timePerPixel');
      const ganttRect = state.get('_internal.elements.chart-timeline').getBoundingClientRect();
      movement.ganttTop = ganttRect.top;
      movement.ganttLeft = ganttRect.left;
      movement.itemX = Math.round((item.time.start - chartLeftTime) / timePerPixel);
      movement.itemLeftCompensation = ev.x - movement.ganttLeft - movement.itemX;
      createGhost(data, ev, ganttRect.left, ganttRect.top);
    }

    function resizerMouseDown(ev) {
      ev.stopPropagation();
      if (ev.button !== 0) {
        return;
      }
      const movement = getMovement(data);
      movement.resizing = true;
      const item = state.get(`config.chart.items.${data.item.id}`);
      const chartLeftTime = state.get('_internal.chart.time.leftGlobal');
      const timePerPixel = state.get('_internal.chart.time.timePerPixel');
      const ganttRect = state.get('_internal.elements.chart-timeline').getBoundingClientRect();
      movement.ganttTop = ganttRect.top;
      movement.ganttLeft = ganttRect.left;
      movement.itemX = (item.time.end - chartLeftTime) / timePerPixel;
      movement.itemLeftCompensation = ev.x - movement.ganttLeft - movement.itemX;
    }

    function isCollision(rowId, itemId, start, end) {
      if (!options.collisionDetection) {
        return false;
      }
      const time = state.get('_internal.chart.time');
      if (options.outOfBorders && (start < time.from || end > time.to)) {
        return true;
      }
      let diff = api.time.date(end).diff(start, 'milliseconds');
      if (Math.sign(diff) === -1) {
        diff = -diff;
      }
      if (diff <= 1) {
        return true;
      }
      const row = state.get('config.list.rows.' + rowId);
      for (const rowItem of row._internal.items) {
        if (rowItem.id !== itemId) {
          if (start >= rowItem.time.start && start <= rowItem.time.end) {
            return true;
          }
          if (end >= rowItem.time.start && end <= rowItem.time.end) {
            return true;
          }
          if (start <= rowItem.time.start && end >= rowItem.time.end) {
            return true;
          }
        }
      }
      return false;
    }

    function movementX(ev, row, item, zoom, timePerPixel) {
      ev.stopPropagation();
      const movement = getMovement(data);
      const left = ev.x - movement.ganttLeft - movement.itemLeftCompensation;
      moveGhost(data, ev);
      const leftMs = state.get('_internal.chart.time.leftGlobal') + left * timePerPixel;
      const add = leftMs - item.time.start;
      const originalStart = item.time.start;
      const finalStartTime = getSnapStart(data)(item.time.start, add, item);
      const finalAdd = finalStartTime - originalStart;
      const collision = isCollision(row.id, item.id, item.time.start + finalAdd, item.time.end + finalAdd);
      if (finalAdd && !collision) {
        state.update(`config.chart.items.${data.item.id}.time`, function moveItem(time) {
          time.start += finalAdd;
          time.end = getSnapEnd(data)(time.end, finalAdd, item) - 1;
          return time;
        });
      }
    }

    function resizeX(ev, row, item, zoom, timePerPixel) {
      ev.stopPropagation();
      if (!isResizeable(data)) {
        return;
      }
      const time = state.get('_internal.chart.time');
      const movement = getMovement(data);
      const left = ev.x - movement.ganttLeft - movement.itemLeftCompensation;
      const leftMs = time.leftGlobal + left * timePerPixel;
      const add = leftMs - item.time.end;
      if (item.time.end + add < item.time.start) {
        return;
      }
      const originalEnd = item.time.end;
      const finalEndTime = getSnapEnd(data)(item.time.end, add, item) - 1;
      const finalAdd = finalEndTime - originalEnd;
      const collision = isCollision(row.id, item.id, item.time.start, item.time.end + finalAdd);
      if (finalAdd && !collision) {
        state.update(`config.chart.items.${data.item.id}.time`, time => {
          time.start = getSnapStart(data)(time.start, 0, item);
          time.end = getSnapEnd(data)(time.end, finalAdd, item) - 1;
          return time;
        });
      }
    }

    function movementY(ev, row, item, zoom, timePerPixel) {
      ev.stopPropagation();
      moveGhost(data, ev);
      const movement = getMovement(data);
      const top = ev.y - movement.ganttTop;
      const visibleRows = state.get('_internal.list.visibleRows');
      const compensation = state.get('config.scroll.compensation');
      let index = 0;
      for (const currentRow of visibleRows) {
        if (currentRow.top + compensation > top) {
          if (index > 0) {
            return index - 1;
          }
          return 0;
        }
        index++;
      }
      return index;
    }

    function documentMouseMove(ev) {
      const movement = getMovement(data);
      let item, rowId, row, zoom, timePerPixel;
      if (movement.moving || movement.resizing) {
        ev.stopPropagation();
        item = state.get(`config.chart.items.${data.item.id}`);
        rowId = state.get(`config.chart.items.${data.item.id}.rowId`);
        row = state.get(`config.list.rows.${rowId}`);
        zoom = state.get('config.chart.time.zoom');
        timePerPixel = state.get('_internal.chart.time.timePerPixel');
      }
      const moveable = isMoveable(data);
      if (movement.moving) {
        if (moveable === true || moveable === 'x' || (Array.isArray(moveable) && moveable.includes(rowId))) {
          movementX(ev, row, item, zoom, timePerPixel);
        }
        if (!moveable || moveable === 'x') {
          return;
        }
        let visibleRowsIndex = movementY(ev);
        const visibleRows = state.get('_internal.list.visibleRows');
        if (typeof visibleRows[visibleRowsIndex] === 'undefined') {
          if (visibleRowsIndex > 0) {
            visibleRowsIndex = visibleRows.length - 1;
          } else if (visibleRowsIndex < 0) {
            visibleRowsIndex = 0;
          }
        }
        const newRow = visibleRows[visibleRowsIndex];
        const newRowId = newRow.id;
        const collision = isCollision(newRowId, item.id, item.time.start, item.time.end);
        if (newRowId !== item.rowId && !collision) {
          if (!Array.isArray(moveable) || moveable.includes(newRowId)) {
            if (!newRow.hasOwnProperty('moveable') || newRow.moveable) {
              state.update(`config.chart.items.${item.id}.rowId`, newRowId);
            }
          }
        }
      } else if (movement.resizing && (typeof item.resizeable === 'undefined' || item.resizeable === true)) {
        resizeX(ev, row, item, zoom, timePerPixel);
      }
    }

    function documentMouseUp(ev) {
      const movement = getMovement(data);
      if (movement.moving || movement.resizing) {
        ev.stopPropagation();
      }
      movement.moving = false;
      movement.resizing = false;
      for (const itemId in movementState) {
        movementState[itemId].moving = false;
        movementState[itemId].resizing = false;
        destroyGhost(itemId);
      }
    }
    element.addEventListener('mousedown', labelMouseDown);
    resizerEl.addEventListener('mousedown', resizerMouseDown, { capture: true });
    document.addEventListener('mousemove', documentMouseMove, { capture: true, passive: true });
    document.addEventListener('mouseup', documentMouseUp, { capture: true, passive: true });
    return {
      update(node, changedData) {
        data = changedData;
        if (!isResizeable(data)) {
          resizerEl.style.visibility = 'hidden';
        } else {
          resizerEl.style.visibility = 'visible';
        }
      },
      destroy(node, data) {
        element.removeEventListener('mousedown', labelMouseDown);
        resizerEl.removeEventListener('mousedown', resizerMouseDown);
        document.removeEventListener('mousemove', documentMouseMove);
        document.removeEventListener('mouseup', documentMouseUp);
        resizerEl.remove();
      }
    };
  }

  return function initialize(vido) {
    vido.state.update('config.actions.chart-timeline-items-row-item', actions => {
      actions.push(action);
      return actions;
    });
  };
}

/**
 * SaveAsImage plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   GPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

// @ts-nocheck
function SaveAsImage(options = {}) {
  const defaultOptions = {
    style: 'font-family: sans-serif;',
    filename: 'gantt-schedule-timeline-calendar.jpeg'
  };
  options = { ...defaultOptions, options };
  function downloadImage(data, filename) {
    const a = document.createElement('a');
    a.href = data;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
  }

  function saveAsImage(ev) {
    const element = ev.target;
    const width = element.clientWidth;
    const height = element.clientHeight;
    const html = unescape(encodeURIComponent(element.outerHTML));
    let style = '';
    for (const styleSheet of document.styleSheets) {
      if (styleSheet.title === 'gstc') {
        for (const rule of styleSheet.rules) {
          style += rule.cssText;
        }
      }
    }
    style = `<style>* {${options.style}} ${style}</style>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject x="0" y="0" width="${width}" height="${height}">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${style}
          ${html}
        </div>
      </foreignObject>
    </svg>`;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    const svg64 = 'data:image/svg+xml;base64,' + btoa(svg);
    const img = new Image();
    img.onload = function onLoad() {
      ctx.drawImage(img, 0, 0);
      const jpeg = canvas.toDataURL('image/jpeg', 1.0);
      downloadImage(jpeg, options.filename);
    };
    img.src = svg64;
  }

  return function initialize(vido) {
    vido.state.subscribe('_internal.elements.main', main => {
      if (main) {
        main.addEventListener('save-as-image', saveAsImage);
      }
    });
  };
}

var rafSchd = function rafSchd(fn) {
  var lastArgs = [];
  var frameId = null;

  var wrapperFn = function wrapperFn() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    lastArgs = args;

    if (frameId) {
      return;
    }

    frameId = requestAnimationFrame(function () {
      frameId = null;
      fn.apply(void 0, lastArgs);
    });
  };

  wrapperFn.cancel = function () {
    if (!frameId) {
      return;
    }

    cancelAnimationFrame(frameId);
    frameId = null;
  };

  return wrapperFn;
};

/**
 * Selection plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   GPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
function Selection(options = {}) {
  let vido, state, api;
  const defaultOptions = {
    grid: false,
    items: true,
    rows: false,
    horizontal: true,
    vertical: true,
    selecting() {},
    deselecting() {},
    selected() {},
    deselected() {}
  };
  options = { ...defaultOptions, ...options };
  let chartTimeline, top, left;
  let selecting = {
    fromX: -1,
    fromY: -1,
    toX: -1,
    toY: -1,
    startX: -1,
    startY: -1,
    startCell: false,
    selecting: false
  };
  const selectionTypesIdGetters = {
    'chart-timeline-grid-row': props => props.row.id,
    'chart-timeline-grid-row-block': props => props.id,
    'chart-timeline-items-row': props => props.row.id,
    'chart-timeline-items-row-item': props => props.item.id
  };
  const path = 'config.plugin.selection';
  const rectClassName = 'gantt-schedule-timeline-caledar__plugin-selection-rect';
  const rect = document.createElement('div');
  rect.classList.add(rectClassName);
  rect.style.visibility = 'hidden';
  rect.style.left = '0px';
  rect.style.top = '0px';
  rect.style.width = '0px';
  rect.style.height = '0px';
  rect.style.background = 'rgba(0, 119, 192, 0.2)';
  rect.style.border = '2px dashed rgba(0, 119, 192, 0.75)';
  rect.style.position = 'absolute';
  rect.style['user-select'] = 'none';
  rect.style['pointer-events'] = 'none';
  if (options.rectStyle) {
    for (const styleProp in options.rectStyle) {
      rect.style[styleProp] = options.rectStyle[styleProp];
    }
  }

  /**
   * Selection action
   * @param {Element} element
   * @param {object|any} data
   * @returns {object} with update and destroy
   */
  function selectionAction(element, data) {
    let previousSelect;
    chartTimeline = state.get('_internal.elements.chart-timeline');
    if (!chartTimeline.querySelector('.' + rectClassName)) {
      chartTimeline.insertAdjacentElement('beforeend', rect);
      const bounding = chartTimeline.getBoundingClientRect();
      left = bounding.left;
      top = bounding.top;
    }

    /**
     * Clear selection
     */
    function clearSelection() {
      state.update(path, {
        selecting: {
          'chart-timeline-grid-rows': [],
          'chart-timeline-grid-row-blocks': [],
          'chart-timeline-items-rows': [],
          'chart-timeline-items-row-items': []
        },
        selected: {
          'chart-timeline-grid-rows': [],
          'chart-timeline-grid-row-blocks': [],
          'chart-timeline-items-rows': [],
          'chart-timeline-items-row-items': []
        }
      });
      state.update('_internal.chart.grid.rowsWithBlocks', function clearRowsWithBlocks(rowsWithBlocks) {
        for (const row of rowsWithBlocks) {
          for (const block of row.blocks) {
            block.selected = false;
            block.selecting = false;
          }
        }
        return rowsWithBlocks;
      });
    }

    /**
     * Clone current selection state
     * @param {object} currentSelect
     * @returns {object} currentSelect cloned
     */
    function cloneSelection(currentSelect) {
      const result = {};
      result.selecting = { ...currentSelect.selecting };
      result.selecting['chart-timeline-grid-rows'] = currentSelect.selecting['chart-timeline-grid-rows'].slice();
      result.selecting['chart-timeline-grid-row-blocks'] = currentSelect.selecting[
        'chart-timeline-grid-row-blocks'
      ].slice();
      result.selecting['chart-timeline-items-rows'] = currentSelect.selecting['chart-timeline-items-rows'].slice();
      result.selecting['chart-timeline-items-row-items'] = currentSelect.selecting[
        'chart-timeline-items-row-items'
      ].slice();
      result.selected = { ...currentSelect.selected };
      result.selected['chart-timeline-grid-rows'] = currentSelect.selected['chart-timeline-grid-rows'].slice();
      result.selected['chart-timeline-grid-row-blocks'] = currentSelect.selected[
        'chart-timeline-grid-row-blocks'
      ].slice();
      result.selected['chart-timeline-items-rows'] = currentSelect.selected['chart-timeline-items-rows'].slice();
      result.selected['chart-timeline-items-row-items'] = currentSelect.selected[
        'chart-timeline-items-row-items'
      ].slice();
      return result;
    }

    /**
     * Save and swap coordinates if needed
     * @param {Event} ev
     */
    function saveAndSwapIfNeeded(ev) {
      // @ts-ignore
      const currentX = ev.x - left;
      // @ts-ignore
      const currentY = ev.y - top;
      if (currentX <= selecting.startX) {
        selecting.fromX = currentX;
        selecting.toX = selecting.startX;
      } else {
        selecting.fromX = selecting.startX;
        selecting.toX = currentX;
      }
      if (currentY <= selecting.startY) {
        selecting.fromY = currentY;
        selecting.toY = selecting.startY;
      } else {
        selecting.fromY = selecting.startY;
        selecting.toY = currentY;
      }
    }

    /**
     * Is rectangle inside other rectangle ?
     * @param {DOMRect} boundingRect
     * @param {DOMRect} rectBoundingRect
     * @returns {boolean}
     */
    function isInside(boundingRect, rectBoundingRect) {
      let horizontal = false;
      let vertical = false;
      if (
        (boundingRect.left >= rectBoundingRect.left && boundingRect.left <= rectBoundingRect.right) ||
        (boundingRect.right >= rectBoundingRect.left && boundingRect.right <= rectBoundingRect.right) ||
        (boundingRect.left <= rectBoundingRect.left && boundingRect.right >= rectBoundingRect.right)
      ) {
        horizontal = true;
      }
      if (
        (boundingRect.top >= rectBoundingRect.top && boundingRect.top <= rectBoundingRect.bottom) ||
        (boundingRect.bottom >= rectBoundingRect.top && boundingRect.bottom <= rectBoundingRect.bottom) ||
        (boundingRect.top <= rectBoundingRect.top && boundingRect.bottom >= rectBoundingRect.bottom)
      ) {
        vertical = true;
      }
      return horizontal && vertical;
    }

    /**
     * Get selecting elements
     * @param {DOMRect} rectBoundingRect
     * @param {Element[]} elements
     * @param {string} type
     * @returns {string[]}
     */
    function getSelecting(rectBoundingRect, elements, type, getId) {
      const selectingResult = [];
      const all = elements[type + 's'];
      const currentSelecting = state.get(`${path}.selecting.${type}s`);
      for (const element of all) {
        const boundingRect = element.getBoundingClientRect();
        if (isInside(boundingRect, rectBoundingRect)) {
          selectingResult.push(getId(element.vido));
          if (!currentSelecting.includes(getId(element.vido))) {
            options.selecting(element.vido, type);
          }
        } else {
          if (currentSelecting.includes(getId(element.vido))) {
            options.deselecting(element.vido, type);
          }
        }
      }
      return selectingResult;
    }

    /**
     * Select
     * @param {Event} ev
     */
    function select(ev) {
      if (!selecting.selecting) {
        return;
      }
      saveAndSwapIfNeeded(ev);
      rect.style.left = selecting.fromX + 'px';
      rect.style.top = selecting.fromY + 'px';
      rect.style.visibility = 'visible';
      rect.style.width = selecting.toX - selecting.fromX + 'px';
      rect.style.height = selecting.toY - selecting.fromY + 'px';
      const rectBoundingRect = rect.getBoundingClientRect();
      const elements = state.get('_internal.elements');
      const nowSelecting = {};
      for (const type in selectionTypesIdGetters) {
        nowSelecting[type + 's'] = getSelecting(rectBoundingRect, elements, type, selectionTypesIdGetters[type]);
      }
      state.update(`${path}.selecting`, nowSelecting);
      state.update('config.chart.items', function updateItems(items) {
        const now = nowSelecting['chart-timeline-items-row-items'];
        for (const itemId in items) {
          const item = items[itemId];
          if (now.includes(item.id)) {
            item.selecting = true;
          } else {
            item.selecting = false;
          }
        }
        return items;
      });
      state.update('_internal.chart.grid.rowsWithBlocks', function updateRowsWithBlocks(rowsWithBlocks) {
        const nowBlocks = nowSelecting['chart-timeline-grid-row-blocks'];
        const nowRows = nowSelecting['chart-timeline-grid-rows'];
        for (const row of rowsWithBlocks) {
          if (nowRows.includes(row.id)) {
            row.selecting = true;
          } else {
            row.selecting = false;
          }
          for (const block of row.blocks) {
            if (nowBlocks.includes(block.id)) {
              block.selecting = true;
            } else {
              block.selecting = false;
            }
          }
        }
        return rowsWithBlocks;
      });
    }

    /**
     * End select
     * @param {Event} ev
     */
    function endSelect(ev) {
      if (selecting.selecting) {
        ev.stopPropagation();
      } else {
        clearSelection();
        return;
      }
      selecting.selecting = false;
      rect.style.visibility = 'hidden';
      const currentSelect = state.get(path);
      const select = {};
      state.update(path, value => {
        select.selected = { ...value.selecting };
        select.selecting = {
          'chart-timeline-grid-rows': [],
          'chart-timeline-grid-row-blocks': [],
          'chart-timeline-items-rows': [],
          'chart-timeline-items-row-items': []
        };
        return select;
      });
      const elements = state.get('_internal.elements');
      for (const type in selectionTypesIdGetters) {
        for (const element of elements[type + 's']) {
          if (currentSelect.selecting[type + 's'].includes(element.vido.id)) {
            options.deselecting(element.vido, type);
          }
        }
      }
      state.update('config.chart.items', function updateItems(items) {
        const now = currentSelect.selecting['chart-timeline-items-row-items'];
        for (const itemId in items) {
          const item = items[itemId];
          if (now.includes(item.id)) {
            item.selecting = true;
          } else {
            item.selecting = false;
          }
        }
        return items;
      });
      state.update('_internal.chart.grid.rowsWithBlocks', function updateRowsWithBlocks(rowsWithBlocks) {
        for (const row of rowsWithBlocks) {
          for (const block of row.blocks) {
            if (currentSelect.selecting['chart-timeline-grid-row-blocks'].includes(block.id)) {
              if (typeof block.selected === 'undefined' || !block.selected) {
                options.selected(block, 'chart-timeline-grid-row-block');
              }
              block.selected = true;
            } else {
              if (previousSelect.selected['chart-timeline-grid-row-blocks'].includes(block.id)) {
                options.deselected(block, 'chart-timeline-grid-row-block');
              }
              block.selected = false;
            }
          }
        }
        return rowsWithBlocks;
      });
    }

    /**
     * Mouse down event handler
     * @param {MouseEvent} ev
     */
    function mouseDown(ev) {
      if (ev.button !== 0) {
        return;
      }
      selecting.selecting = true;
      selecting.fromX = ev.x - left;
      selecting.fromY = ev.y - top;
      selecting.startX = selecting.fromX;
      selecting.startY = selecting.fromY;
      previousSelect = cloneSelection(state.get(path));
      clearSelection();
    }

    /**
     * Mouse move event handler
     * @param {MouseEvent} ev
     */
    function mouseMove(ev) {
      select(ev);
    }

    /**
     * Mouse up event handler
     * @param {MouseEvent} ev
     */
    function mouseUp(ev) {
      endSelect(ev);
    }

    element.addEventListener('mousedown', mouseDown);
    document.addEventListener('mousemove', rafSchd(mouseMove));
    document.body.addEventListener('mouseup', mouseUp);
    return {
      update() {},
      destroy() {
        document.body.removeEventListener('mouseup', mouseUp);
        document.removeEventListener('mousemove', mouseMove);
        element.removeEventListener('mousedown', mouseDown);
      }
    };
  }

  /**
   * Grid row block action
   * @param {Element} element
   * @param {object} data
   * @returns {object} with update and destroy functions
   */
  function gridBlockAction(element, data) {
    const classNameSelecting = api.getClass('chart-timeline-grid-row-block') + '--selecting';
    const classNameSelected = api.getClass('chart-timeline-grid-row-block') + '--selected';
    if (data.selecting) {
      element.classList.add(classNameSelecting);
    } else {
      element.classList.remove(classNameSelecting);
    }
    if (data.selected) {
      element.classList.add(classNameSelected);
    } else {
      element.classList.remove(classNameSelected);
    }

    return {
      update(element, data) {
        if (data.selecting) {
          element.classList.add(classNameSelecting);
        } else {
          element.classList.remove(classNameSelecting);
        }
        if (data.selected) {
          element.classList.add(classNameSelected);
        } else {
          element.classList.remove(classNameSelected);
        }
      },
      destroy(element, changedData) {
        element.classList.remove(classNameSelecting);
        element.classList.remove(classNameSelected);
      }
    };
  }

  /**
   * Item action
   * @param {Element} element
   * @param {object} data
   * @returns {object} with update and destroy functions
   */
  function itemAction(element, data) {
    const classNameSelecting = api.getClass('chart-timeline-items-row-item') + '--selecting';
    const classNameSelected = api.getClass('chart-timeline-items-row-item') + '--selected';
    if (data.item.selecting) {
      element.classList.add(classNameSelecting);
    } else {
      element.classList.remove(classNameSelecting);
    }
    if (data.item.selected) {
      element.classList.add(classNameSelected);
    } else {
      element.classList.remove(classNameSelected);
    }
    return {
      update(element, data) {
        if (data.item.selecting) {
          element.classList.add(classNameSelecting);
        } else {
          element.classList.remove(classNameSelecting);
        }
        if (data.item.selected) {
          element.classList.add(classNameSelected);
        } else {
          element.classList.remove(classNameSelected);
        }
      },
      destroy(element, changedData) {
        element.classList.remove(classNameSelecting);
        element.classList.remove(classNameSelected);
      }
    };
  }

  /**
   * On block create handler
   * @param {object} block
   * @returns {object} block
   */
  function onBlockCreate(block) {
    const select = state.get('config.plugin.selection');
    if (select.selected['chart-timeline-grid-row-blocks'].find(id => id === block.id)) {
      block.selected = true;
    } else {
      block.selected = false;
    }
    return block;
  }

  return function initialize(mainVido) {
    vido = mainVido;
    state = vido.state;
    api = vido.api;
    if (typeof state.get(path) === 'undefined') {
      state.update(path, {
        selecting: {
          'chart-timeline-grid-rows': [],
          'chart-timeline-grid-row-blocks': [],
          'chart-timeline-items-rows': [],
          'chart-timeline-items-row-items': []
        },
        selected: {
          'chart-timeline-grid-rows': [],
          'chart-timeline-grid-row-blocks': [],
          'chart-timeline-items-rows': [],
          'chart-timeline-items-row-items': []
        }
      });
    }
    state.update('config.chart.items', items => {
      for (const itemId in items) {
        const item = items[itemId];
        if (typeof item.selecting === 'undefined') {
          item.selecting = false;
        }
        if (typeof item.selected === 'undefined') {
          item.selected = false;
        }
      }
      return items;
    });
    state.update('config.actions.chart-timeline', actions => {
      actions.push(selectionAction);
      return actions;
    });
    state.update('config.actions.chart-timeline-grid-row-block', actions => {
      actions.push(gridBlockAction);
      return actions;
    });
    state.update('config.actions.chart-timeline-items-row-item', actions => {
      actions.push(itemAction);
      return actions;
    });
    state.update('config.chart.grid.block.onCreate', onCreate => {
      onCreate.push(onBlockCreate);
      return onCreate;
    });
  };
}

export { ItemHold, ItemMovement, SaveAsImage, Selection };
//# sourceMappingURL=plugins.js.map
