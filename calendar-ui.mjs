import { DAYS, createAvailabilityState, minutesToTime, replaceAvailabilityBlock, timeToMinutes } from "./calendar-state.mjs";
import { blocksToLegacyFields } from "./availability-adapter.mjs";
import { openAvailabilityEditor } from "./calendar-editor-ui.mjs";
import { STEP, renderCalendar } from "./calendar-view-ui.mjs";

export class AvailabilityCalendar {
  constructor(root, { blocks = [], label = "When are you available?", onChange = () => {} } = {}) {
    this.root = root;
    this.state = createAvailabilityState(blocks);
    this.label = label;
    this.onChange = onChange;
    this.mobileDay = DAYS[0];
    this.drag = null;
    this.editor = null;
  }

  emit() {
    try {
      this.onChange(this.state.blocks, blocksToLegacyFields(this.state.blocks));
    } catch (error) {
      console.error("[DDD Calendar] Unable to publish availability changes", error);
    }
  }

  addBlock(day, start, end) {
    try {
      this.state = createAvailabilityState([...this.state.blocks, {
        day, start, end, recurrence: { type: "weekly", interval: 1, anchorDate: null }
      }]);
      this.render();
      this.emit();
    } catch (error) {
      console.error("[DDD Calendar] Unable to add availability", error);
    }
  }

  updateBlock(id, replacement) {
    try {
      this.state = Object.freeze({ blocks: Object.freeze(replaceAvailabilityBlock(this.state.blocks, id, replacement)) });
      this.render();
      this.emit();
    } catch (error) {
      console.error("[DDD Calendar] Unable to update availability", error);
    }
  }

  removeBlock(id) {
    try {
      this.state = createAvailabilityState(this.state.blocks.filter((block) => block.id !== id));
      this.render();
      this.emit();
    } catch (error) {
      console.error("[DDD Calendar] Unable to remove availability", error);
    }
  }

  beginDrag(day, minutes) {
    this.drag = { day, start: minutes, end: minutes + STEP };
    this.paintDrag();
  }

  extendDrag(day, minutes) {
    if (!this.drag || this.drag.day !== day) return;
    this.drag.end = minutes + STEP;
    this.paintDrag();
  }

  finishDrag() {
    try {
      if (!this.drag) return;
      const low = Math.min(this.drag.start, this.drag.end - STEP);
      const high = Math.max(this.drag.start + STEP, this.drag.end);
      this.addBlock(this.drag.day, minutesToTime(low), minutesToTime(high));
    } finally {
      this.drag = null;
    }
  }

  paintDrag() {
    try {
      this.root.querySelectorAll(".time-slot.is-dragging").forEach((node) => node.classList.remove("is-dragging"));
      if (!this.drag) return;
      const low = Math.min(this.drag.start, this.drag.end - STEP);
      const high = Math.max(this.drag.start + STEP, this.drag.end);
      this.root.querySelectorAll(`.time-slot[data-day="${this.drag.day}"]`).forEach((slot) => {
        const minutes = Number(slot.dataset.minutes);
        if (minutes >= low && minutes < high) slot.classList.add("is-dragging");
      });
    } catch (error) {
      console.error("[DDD Calendar] Unable to paint availability drag", error);
    }
  }

  blockAt(day, minutes) {
    try {
      return this.state.blocks.find((block) => block.day === day && minutes >= timeToMinutes(block.start) && minutes < timeToMinutes(block.end)) || null;
    } catch (error) {
      console.error("[DDD Calendar] Unable to resolve selected slot", error);
      return null;
    }
  }

  openEditor(block) { openAvailabilityEditor(this, block); }
  render() { renderCalendar(this); }
}
