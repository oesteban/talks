(function () {
  'use strict';

  var slideshow = window.slideshow;
  if (!slideshow || typeof slideshow.on !== 'function') {
    return;
  }


  function parseHideRanges(value) {
    if (!value) {
      return [];
    }

    var ranges = [];
    var segments = String(value)
      .split(/[\s,]+/)
      .map(function (segment) {
        return segment.trim();
      })
      .filter(function (segment) {
        return segment.length > 0;
      });

    for (var i = 0; i < segments.length; i++) {
      var match = segments[i].match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?|end))?$/i);
      if (!match) {
        continue;
      }

      var start = parseFloat(match[1]);
      if (!isFinite(start)) {
        continue;
      }

      var endToken = match[2];
      var end;
      if (!endToken) {
        end = start;
      } else if (/^end$/i.test(endToken)) {
        end = Infinity;
      } else {
        end = parseFloat(endToken);
        if (!isFinite(end)) {
          continue;
        }
      }

      if (end < start) {
        var temp = start;
        start = end;
        end = temp;
      }

      ranges.push({
        start: start,
        end: end
      });
    }

    return ranges;
  }

  function isHiddenAtStep(ranges, step) {
    if (!ranges || !ranges.length) {
      return false;
    }

    if (typeof step !== 'number' || !isFinite(step)) {
      return false;
    }

    for (var i = 0; i < ranges.length; i++) {
      var range = ranges[i];
      if (step >= range.start && step <= range.end) {
        return true;
      }
    }

    return false;
  }

  function StepNode(element, step, hideRanges) {
    this.element = element;
    this.step = step;
    this.hideRanges = hideRanges || [];
    this.isSvgElement = element && element.namespaceURI === 'http://www.w3.org/2000/svg';
    this.originalDisplayStyle = element ? element.style.display : '';
    this.originalSvgDisplay = this.isSvgElement ? element.getAttribute('display') : null;
  }

  StepNode.prototype.setVisible = function (visible) {
    if (visible) {
      this.show();
    } else {
      this.hide();
    }
  };

  StepNode.prototype.show = function () {
    if (this.isSvgElement) {
      if (this.originalSvgDisplay === null) {
        this.element.removeAttribute('display');
      } else {
        this.element.setAttribute('display', this.originalSvgDisplay);
      }
    }
    this.element.style.display = this.originalDisplayStyle || '';
  };

  StepNode.prototype.hide = function () {
    if (this.isSvgElement) {
      this.element.setAttribute('display', 'none');
    }
    this.element.style.display = 'none';
  };

  function StepController(root) {
    this.root = root;
    this.stepNodes = [];
    this.stepValues = [];
    this._seenSteps = Object.create(null);
    this._collect();
  }

  StepController.prototype._collect = function () {
    if (!this.root) {
      return;
    }

    if (this.root.nodeType === 1 && this.root.hasAttribute && this.root.hasAttribute('data-step')) {
      this._addElement(this.root);
    }

    var elements = this.root.querySelectorAll ? this.root.querySelectorAll('[data-step]') : [];
    for (var i = 0; i < elements.length; i++) {
      this._addElement(elements[i]);
    }

    this.stepValues.sort(function (a, b) {
      return a - b;
    });

    this.hideAll();
  };

  StepController.prototype._addElement = function (element) {
    if (!element || !element.getAttribute) {
      return;
    }

    var rawStep = element.getAttribute('data-step');
    if (rawStep === null) {
      return;
    }

    var stepValue = parseFloat(rawStep);
    if (!isFinite(stepValue)) {
      return;
    }

    var hideRanges = parseHideRanges(element.getAttribute('data-hide'));
    var node = new StepNode(element, stepValue, hideRanges);
    this.stepNodes.push(node);

    var key = String(stepValue);
    if (!Object.prototype.hasOwnProperty.call(this._seenSteps, key)) {
      this._seenSteps[key] = true;
      this.stepValues.push(stepValue);
    }
  };

  StepController.prototype.hasSteps = function () {
    return this.stepNodes.length > 0;
  };

  StepController.prototype.getSteps = function () {
    return this.stepValues.slice();
  };

  StepController.prototype.applyStep = function (stepValue) {
    var hasStep = typeof stepValue === 'number' && isFinite(stepValue);
    for (var i = 0; i < this.stepNodes.length; i++) {
      var node = this.stepNodes[i];
      var visible = hasStep && stepValue >= node.step;
      if (visible && node.hideRanges.length && isHiddenAtStep(node.hideRanges, stepValue)) {
        visible = false;
      }
      node.setVisible(visible);
    }
  };

  StepController.prototype.hideAll = function () {
    for (var i = 0; i < this.stepNodes.length; i++) {
      this.stepNodes[i].hide();
    }
  };

  function StepSlide(container) {
    this.container = container;
    this.controllers = [];
    this.stepOrder = [];
    this.currentStepValue = null;
    this.pendingAction = null;
    this.objectControllers = new Map();
    this.pendingObjects = new Set();
    this._initialize();
  }

  StepSlide.prototype._initialize = function () {
    var contentRoot = this._findContentRoot();
    if (contentRoot) {
      var controller = new StepController(contentRoot);
      if (controller.hasSteps()) {
        this.controllers.push(controller);
      }
    }

    this._scanObjectElements();
    this._controllersChanged();
  };

  StepSlide.prototype._findContentRoot = function () {
    var content = this.container.querySelector('.remark-slide-content');
    if (content) {
      return content;
    }

    var slide = this.container.querySelector('.remark-slide');
    if (slide) {
      return slide;
    }

    return this.container;
  };

  StepSlide.prototype._scanObjectElements = function () {
    var objects = this.container.querySelectorAll('object[type="image/svg+xml"]');
    for (var i = 0; i < objects.length; i++) {
      this._attachObjectController(objects[i]);
    }
  };

  StepSlide.prototype._attachObjectController = function (objectEl) {
    if (!objectEl || this.objectControllers.has(objectEl)) {
      return;
    }

    this.objectControllers.set(objectEl, null);
    this.pendingObjects.add(objectEl);

    var self = this;

    function createControllerFromObject() {
      var doc = objectEl.contentDocument;
      if (!doc) {
        return { processed: false, added: false };
      }

      var previous = self.objectControllers.get(objectEl);
      if (previous) {
        var index = self.controllers.indexOf(previous);
        if (index !== -1) {
          self.controllers.splice(index, 1);
        }
      }

      var svgRoot = doc.documentElement && doc.documentElement.tagName &&
        doc.documentElement.tagName.toLowerCase() === 'svg'
        ? doc.documentElement
        : doc.querySelector('svg');

      var controller = null;
      if (svgRoot) {
        controller = new StepController(svgRoot);
        if (!controller.hasSteps()) {
          controller = null;
        }
      }

      self.objectControllers.set(objectEl, controller);
      if (controller) {
        self.controllers.push(controller);
      }

      self._controllersChanged();
      return { processed: true, added: !!controller };
    }

    function finalizeProcessing(processed) {
      if (!processed) {
        return;
      }
      if (self.pendingObjects.has(objectEl)) {
        self.pendingObjects.delete(objectEl);
      }
    }

    objectEl.addEventListener('load', function () {
      var result = createControllerFromObject();
      finalizeProcessing(result.processed);
    });

    var initialResult = createControllerFromObject();
    finalizeProcessing(initialResult.processed);
  };

  StepSlide.prototype._controllersChanged = function () {
    this._rebuildStepOrder();

    if (this.pendingAction && !this.hasSteps() && !this.isWaiting()) {
      this.pendingAction = null;
    }

    if (this.pendingAction) {
      var action = this.pendingAction;
      this.pendingAction = null;
      if (action === 'first') {
        this.showFirst();
        return;
      }
      if (action === 'all') {
        this.showAll();
        return;
      }
    }

    if (this.currentStepValue !== null) {
      if (!this.hasSteps()) {
        this.currentStepValue = null;
        this._hideAllControllers();
      } else {
        var normalized = this._normalizeStepValue(this.currentStepValue);
        this.currentStepValue = normalized;
        this._applyCurrentStep();
      }
    } else if (!this.hasSteps()) {
      this._hideAllControllers();
    }
  };

  StepSlide.prototype._rebuildStepOrder = function () {
    var seen = Object.create(null);
    var values = [];

    for (var i = 0; i < this.controllers.length; i++) {
      var controller = this.controllers[i];
      if (!controller || !controller.hasSteps()) {
        continue;
      }

      var steps = controller.getSteps();
      for (var j = 0; j < steps.length; j++) {
        var value = steps[j];
        var key = String(value);
        if (!Object.prototype.hasOwnProperty.call(seen, key)) {
          seen[key] = true;
          values.push(value);
        }
      }
    }

    values.sort(function (a, b) {
      return a - b;
    });
    this.stepOrder = values;
  };

  StepSlide.prototype._normalizeStepValue = function (value) {
    if (!this.hasSteps()) {
      return null;
    }

    for (var i = 0; i < this.stepOrder.length; i++) {
      if (this.stepOrder[i] === value) {
        return value;
      }
    }

    for (var j = 0; j < this.stepOrder.length; j++) {
      if (this.stepOrder[j] > value) {
        return this.stepOrder[j];
      }
    }

    return this.stepOrder[this.stepOrder.length - 1];
  };

  StepSlide.prototype._applyCurrentStep = function () {
    for (var i = 0; i < this.controllers.length; i++) {
      this.controllers[i].applyStep(this.currentStepValue);
    }
  };

  StepSlide.prototype._hideAllControllers = function () {
    for (var i = 0; i < this.controllers.length; i++) {
      this.controllers[i].hideAll();
    }
  };

  StepSlide.prototype.hasSteps = function () {
    return this.stepOrder.length > 0;
  };

  StepSlide.prototype.isWaiting = function () {
    return this.pendingObjects.size > 0;
  };

  StepSlide.prototype.showFirst = function () {
    if (!this.hasSteps()) {
      this.pendingAction = this.isWaiting() ? 'first' : null;
      this.currentStepValue = null;
      this._hideAllControllers();
      return;
    }

    this.pendingAction = null;
    this.currentStepValue = this.stepOrder[0];
    this._applyCurrentStep();
  };

  StepSlide.prototype.showAll = function () {
    if (!this.hasSteps()) {
      this.pendingAction = this.isWaiting() ? 'all' : null;
      this.currentStepValue = null;
      this._hideAllControllers();
      return;
    }

    this.pendingAction = null;
    this.currentStepValue = this.stepOrder[this.stepOrder.length - 1];
    this._applyCurrentStep();
  };

  StepSlide.prototype.stepForward = function () {
    if (!this.hasSteps()) {
      return this.isWaiting();
    }

    if (this.currentStepValue === null) {
      this.currentStepValue = this.stepOrder[0];
      this._applyCurrentStep();
      return true;
    }

    var index = this.stepOrder.indexOf(this.currentStepValue);
    if (index === -1) {
      this.currentStepValue = this.stepOrder[0];
      this._applyCurrentStep();
      return true;
    }

    if (index < this.stepOrder.length - 1) {
      this.currentStepValue = this.stepOrder[index + 1];
      this._applyCurrentStep();
      return true;
    }

    return false;
  };

  StepSlide.prototype.stepBackward = function () {
    if (!this.hasSteps()) {
      return false;
    }

    if (this.currentStepValue === null) {
      this.currentStepValue = this.stepOrder[this.stepOrder.length - 1];
      this._applyCurrentStep();
      return true;
    }

    var index = this.stepOrder.indexOf(this.currentStepValue);
    if (index === -1) {
      this.currentStepValue = this.stepOrder[this.stepOrder.length - 1];
      this._applyCurrentStep();
      return true;
    }

    if (index > 0) {
      this.currentStepValue = this.stepOrder[index - 1];
      this._applyCurrentStep();
      return true;
    }

    return false;
  };

  function visibleSlideRoot() {
    return document.querySelector('.remark-slide-container.remark-visible');
  }

  function slideHasStepwiseClass(slideElement) {
    if (!slideElement) {
      return false;
    }

    var candidates = [slideElement];
    var remarkSlide = slideElement.querySelector('.remark-slide');
    if (remarkSlide) {
      candidates.push(remarkSlide);
    }

    var content = slideElement.querySelector('.remark-slide-content');
    if (content) {
      candidates.push(content);
    }

    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (candidate && candidate.classList && candidate.classList.contains('stepwise-svg')) {
        return true;
      }
    }

    return false;
  }

  var stepSlideCache = new Map();
  var activeStepSlide = null;
  var lastSlideIndex = null;

  function getStepSlide(index, container) {
    if (!container) {
      return null;
    }

    if (stepSlideCache.has(index)) {
      var cached = stepSlideCache.get(index);
      if (cached && cached.container !== container) {
        cached = new StepSlide(container);
        stepSlideCache.set(index, cached);
      }
      return cached;
    }

    var stepSlide = new StepSlide(container);
    stepSlideCache.set(index, stepSlide);
    return stepSlide;
  }

  slideshow.on('beforeHideSlide', function () {
    activeStepSlide = null;
  });

  slideshow.on('afterShowSlide', function (slide) {
    var slideIndex = slide.getSlideIndex();
    var direction = 'forward';
    if (lastSlideIndex !== null && slideIndex < lastSlideIndex) {
      direction = 'backward';
    }

    var root = visibleSlideRoot();
    if (!root || !slideHasStepwiseClass(root)) {
      activeStepSlide = null;
      lastSlideIndex = slideIndex;
      return;
    }

    var stepSlide = getStepSlide(slideIndex, root);
    activeStepSlide = stepSlide;

    if (direction === 'backward') {
      stepSlide.showAll();
    } else {
      stepSlide.showFirst();
    }

    lastSlideIndex = slideIndex;
  });

  document.addEventListener('keydown', function (event) {
    if (!activeStepSlide) {
      return;
    }

    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    var target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
      return;
    }

    var key = event.key;
    var isForwardKey = key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Spacebar';
    var isBackwardKey = key === 'ArrowLeft' || key === 'PageUp';

    if (isForwardKey) {
      if (activeStepSlide.stepForward()) {
        event.preventDefault();
        event.stopPropagation();
      }
    } else if (isBackwardKey) {
      if (activeStepSlide.stepBackward()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }, true);
})();
