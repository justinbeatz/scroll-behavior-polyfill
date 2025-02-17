(function() {
	"use strict";

	var UNSUPPORTED_ENVIRONMENT = typeof window === "undefined";

	/**
	 * Is true if the browser natively supports the 'scroll-behavior' CSS-property.
	 * @type {boolean}
	 */
	var SUPPORTS_SCROLL_BEHAVIOR = UNSUPPORTED_ENVIRONMENT ? false : "scrollBehavior" in document.documentElement.style;

	/*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

	var __assign = function() {
		__assign =
			Object.assign ||
			function __assign(t) {
				for (var s, i = 1, n = arguments.length; i < n; i++) {
					s = arguments[i];
					for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
				}
				return t;
			};
		return __assign.apply(this, arguments);
	};

	function __read(o, n) {
		var m = typeof Symbol === "function" && o[Symbol.iterator];
		if (!m) return o;
		var i = m.call(o),
			r,
			ar = [],
			e;
		try {
			while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
		} catch (error) {
			e = {error: error};
		} finally {
			try {
				if (r && !r.done && (m = i["return"])) m.call(i);
			} finally {
				if (e) throw e.error;
			}
		}
		return ar;
	}

	function getScrollingElement() {
		if (document.scrollingElement != null) {
			return document.scrollingElement;
		} else {
			return document.documentElement;
		}
	}

	var STYLE_ATTRIBUTE_PROPERTY_NAME = "scroll-behavior";
	var STYLE_ATTRIBUTE_PROPERTY_REGEXP = new RegExp(STYLE_ATTRIBUTE_PROPERTY_NAME + ":\\s*([^;]*)");
	/**
	 * Given an Element, this function appends the given ScrollBehavior CSS property value to the elements' 'style' attribute.
	 * If it doesnt already have one, it will add it.
	 * @param {Element} element
	 * @param {ScrollBehavior} behavior
	 */
	function appendScrollBehaviorToStyleAttribute(element, behavior) {
		var addition = STYLE_ATTRIBUTE_PROPERTY_NAME + ":" + behavior;
		var attributeValue = element.getAttribute("style");
		if (attributeValue == null || attributeValue === "") {
			element.setAttribute("style", addition);
			return;
		}
		// The style attribute may already include a 'scroll-behavior:<something>' in which case that should be replaced
		var existingValueForProperty = parseScrollBehaviorFromStyleAttribute(element);
		if (existingValueForProperty != null) {
			var replacementProperty = STYLE_ATTRIBUTE_PROPERTY_NAME + ":" + existingValueForProperty;
			// Replace the variant that ends with a semi-colon which it may
			attributeValue = attributeValue.replace(replacementProperty + ";", "");
			// Replace the variant that *doesn't* end with a semi-colon
			attributeValue = attributeValue.replace(replacementProperty, "");
		}
		// Now, append the behavior to the string.
		element.setAttribute("style", attributeValue.endsWith(";") ? "" + attributeValue + addition : ";" + attributeValue + addition);
	}
	/**
	 * Given an Element, this function attempts to parse its 'style' attribute (if it has one)' to extract
	 * a value for the 'scroll-behavior' CSS property (if it is given within that style attribute)
	 * @param {Element} element
	 * @returns {ScrollBehavior?}
	 */
	function parseScrollBehaviorFromStyleAttribute(element) {
		var styleAttributeValue = element.getAttribute("style");
		if (styleAttributeValue != null && styleAttributeValue.includes(STYLE_ATTRIBUTE_PROPERTY_NAME)) {
			var match = styleAttributeValue.match(STYLE_ATTRIBUTE_PROPERTY_REGEXP);
			if (match != null) {
				var _a = __read(match, 2),
					behavior = _a[1];
				if (behavior != null && behavior !== "") {
					return behavior;
				}
			}
		}
		return undefined;
	}

	var styleDeclarationPropertyName = "scrollBehavior";
	/**
	 * Determines the scroll behavior to use, depending on the given ScrollOptions and the position of the Element
	 * within the DOM
	 * @param {Element|HTMLElement|Window} inputTarget
	 * @param {ScrollOptions} [options]
	 * @returns {ScrollBehavior}
	 */
	function getScrollBehavior(inputTarget, options) {
		// If the given 'behavior' is 'smooth', apply smooth scrolling no matter what
		if (options != null && options.behavior === "smooth") return "smooth";
		var target = "style" in inputTarget ? inputTarget : getScrollingElement();
		var value;
		if ("style" in target) {
			// Check if scroll-behavior is set as a property on the CSSStyleDeclaration
			var scrollBehaviorPropertyValue = target.style[styleDeclarationPropertyName];
			// Return it if it is given and has a proper value
			if (scrollBehaviorPropertyValue != null && scrollBehaviorPropertyValue !== "") {
				value = scrollBehaviorPropertyValue;
			}
		}
		if (value == null) {
			var attributeValue = target.getAttribute("scroll-behavior");
			if (attributeValue != null && attributeValue !== "") {
				value = attributeValue;
			}
		}
		if (value == null) {
			// Otherwise, check if it is set as an inline style
			value = parseScrollBehaviorFromStyleAttribute(target);
		}
		if (value == null) {
			// Take the computed style for the element and see if it contains a specific 'scroll-behavior' value
			var computedStyle = getComputedStyle(target);
			var computedStyleValue = computedStyle.getPropertyValue("scrollBehavior");
			if (computedStyleValue != null && computedStyleValue !== "") {
				value = computedStyleValue;
			}
		}
		// In all other cases, use the value from the CSSOM
		return value;
	}

	var HALF = 0.5;
	/**
	 * The easing function to use when applying the smooth scrolling
	 * @param {number} k
	 * @returns {number}
	 */
	function ease(k) {
		return HALF * (1 - Math.cos(Math.PI * k));
	}

	var NOOP = {
		reset: function() {}
	};
	var map = typeof WeakMap === "undefined" ? undefined : new WeakMap();
	function disableScrollSnap(scroller) {
		// If scroll-behavior is natively supported, or if there is no native WeakMap support, there's no need for this fix
		if (SUPPORTS_SCROLL_BEHAVIOR || map == null) {
			return NOOP;
		}
		var scrollingElement = getScrollingElement();
		var cachedScrollSnapValue;
		var cachedScrollBehaviorStyleAttributeValue;
		var secondaryScroller;
		var secondaryScrollerCachedScrollSnapValue;
		var secondaryScrollerCachedScrollBehaviorStyleAttributeValue;
		var existingResult = map.get(scroller);
		if (existingResult != null) {
			cachedScrollSnapValue = existingResult.cachedScrollSnapValue;
			cachedScrollBehaviorStyleAttributeValue = existingResult.cachedScrollBehaviorStyleAttributeValue;
			secondaryScroller = existingResult.secondaryScroller;
			secondaryScrollerCachedScrollSnapValue = existingResult.secondaryScrollerCachedScrollSnapValue;
			secondaryScrollerCachedScrollBehaviorStyleAttributeValue = existingResult.secondaryScrollerCachedScrollBehaviorStyleAttributeValue;
			existingResult.release();
		} else {
			cachedScrollSnapValue = scroller.style.scrollSnapType === "" ? null : scroller.style.scrollSnapType;
			cachedScrollBehaviorStyleAttributeValue = parseScrollBehaviorFromStyleAttribute(scroller);
			secondaryScroller = scroller === scrollingElement && scrollingElement !== document.body ? document.body : undefined;
			secondaryScrollerCachedScrollSnapValue =
				secondaryScroller == null ? undefined : secondaryScroller.style.scrollSnapType === "" ? null : secondaryScroller.style.scrollSnapType;
			secondaryScrollerCachedScrollBehaviorStyleAttributeValue =
				secondaryScroller == null ? undefined : parseScrollBehaviorFromStyleAttribute(secondaryScroller);
			var cachedComputedScrollSnapValue = getComputedStyle(scroller).getPropertyValue("scroll-snap-type");
			var secondaryScrollerCachedComputedScrollSnapValue =
				secondaryScroller == null ? undefined : getComputedStyle(secondaryScroller).getPropertyValue("scroll-snap-type");
			// If it just so happens that there actually isn't any scroll snapping going on, there's no point in performing any additional work here.
			if (cachedComputedScrollSnapValue === "none" && secondaryScrollerCachedComputedScrollSnapValue === "none") {
				return NOOP;
			}
		}
		scroller.style.scrollSnapType = "none";
		if (secondaryScroller !== undefined) {
			secondaryScroller.style.scrollSnapType = "none";
		}
		if (cachedScrollBehaviorStyleAttributeValue !== undefined) {
			appendScrollBehaviorToStyleAttribute(scroller, cachedScrollBehaviorStyleAttributeValue);
		}
		if (secondaryScroller !== undefined && secondaryScrollerCachedScrollBehaviorStyleAttributeValue !== undefined) {
			appendScrollBehaviorToStyleAttribute(secondaryScroller, secondaryScrollerCachedScrollBehaviorStyleAttributeValue);
		}
		var hasReleased = false;
		var eventTarget = scroller === scrollingElement ? window : scroller;
		function release() {
			eventTarget.removeEventListener("scroll", resetHandler);
			if (map != null) {
				map["delete"](scroller);
			}
			hasReleased = true;
		}
		function resetHandler() {
			scroller.style.scrollSnapType = cachedScrollSnapValue;
			if (secondaryScroller != null && secondaryScrollerCachedScrollSnapValue !== undefined) {
				secondaryScroller.style.scrollSnapType = secondaryScrollerCachedScrollSnapValue;
			}
			if (cachedScrollBehaviorStyleAttributeValue !== undefined) {
				appendScrollBehaviorToStyleAttribute(scroller, cachedScrollBehaviorStyleAttributeValue);
			}
			if (secondaryScroller !== undefined && secondaryScrollerCachedScrollBehaviorStyleAttributeValue !== undefined) {
				appendScrollBehaviorToStyleAttribute(secondaryScroller, secondaryScrollerCachedScrollBehaviorStyleAttributeValue);
			}
			release();
		}
		function reset() {
			setTimeout(function() {
				if (hasReleased) return;
				eventTarget.addEventListener("scroll", resetHandler);
			});
		}
		map.set(scroller, {
			release: release,
			cachedScrollSnapValue: cachedScrollSnapValue,
			cachedScrollBehaviorStyleAttributeValue: cachedScrollBehaviorStyleAttributeValue,
			secondaryScroller: secondaryScroller,
			secondaryScrollerCachedScrollSnapValue: secondaryScrollerCachedScrollSnapValue,
			secondaryScrollerCachedScrollBehaviorStyleAttributeValue: secondaryScrollerCachedScrollBehaviorStyleAttributeValue
		});
		return {
			reset: reset
		};
	}

	/**
	 * The duration of a smooth scroll
	 * @type {number}
	 */
	var SCROLL_TIME = 15000;
	/**
	 * Performs a smooth repositioning of the scroll
	 * @param {ISmoothScrollOptions} options
	 */
	function smoothScroll(options) {
		var startTime = options.startTime,
			startX = options.startX,
			startY = options.startY,
			endX = options.endX,
			endY = options.endY,
			method = options.method,
			scroller = options.scroller;
		var timeLapsed = 0;
		var distanceX = endX - startX;
		var distanceY = endY - startY;
		var speed = Math.max(Math.abs((distanceX / 1000) * SCROLL_TIME), Math.abs((distanceY / 1000) * SCROLL_TIME));
		// Temporarily disables any scroll snapping that may be active since it fights for control over the scroller with this polyfill
		var scrollSnapFix = disableScrollSnap(scroller);
		requestAnimationFrame(function animate(timestamp) {
			timeLapsed += timestamp - startTime;
			var percentage = Math.max(0, Math.min(1, speed === 0 ? 0 : timeLapsed / speed));
			var positionX = Math.floor(startX + distanceX * ease(percentage));
			var positionY = Math.floor(startY + distanceY * ease(percentage));
			method(positionX, positionY);
			if (positionX !== endX || positionY !== endY) {
				requestAnimationFrame(animate);
			} else {
				if (scrollSnapFix != null) {
					scrollSnapFix.reset();
					scrollSnapFix = undefined;
				}
			}
		});
	}

	/**
	 * Returns a High Resolution timestamp if possible, otherwise fallbacks to Date.now()
	 * @returns {number}
	 */
	function now() {
		if ("performance" in window) return performance.now();
		return Date.now();
	}

	var ELEMENT_ORIGINAL_SCROLL = UNSUPPORTED_ENVIRONMENT ? undefined : Element.prototype.scroll;

	var WINDOW_ORIGINAL_SCROLL = UNSUPPORTED_ENVIRONMENT ? undefined : window.scroll;

	var ELEMENT_ORIGINAL_SCROLL_BY = UNSUPPORTED_ENVIRONMENT ? undefined : Element.prototype.scrollBy;

	var WINDOW_ORIGINAL_SCROLL_BY = UNSUPPORTED_ENVIRONMENT ? undefined : window.scrollBy;

	var ELEMENT_ORIGINAL_SCROLL_TO = UNSUPPORTED_ENVIRONMENT ? undefined : Element.prototype.scrollTo;

	var WINDOW_ORIGINAL_SCROLL_TO = UNSUPPORTED_ENVIRONMENT ? undefined : window.scrollTo;

	/**
	 * A fallback if Element.prototype.scroll is not defined
	 * @param {number} x
	 * @param {number} y
	 */
	function elementPrototypeScrollFallback(x, y) {
		this.__adjustingScrollPosition = true;
		this.scrollLeft = x;
		this.scrollTop = y;
		delete this.__adjustingScrollPosition;
	}
	/**
	 * A fallback if Element.prototype.scrollTo is not defined
	 * @param {number} x
	 * @param {number} y
	 */
	function elementPrototypeScrollToFallback(x, y) {
		return elementPrototypeScrollFallback.call(this, x, y);
	}
	/**
	 * A fallback if Element.prototype.scrollBy is not defined
	 * @param {number} x
	 * @param {number} y
	 */
	function elementPrototypeScrollByFallback(x, y) {
		this.__adjustingScrollPosition = true;
		this.scrollLeft += x;
		this.scrollTop += y;
		delete this.__adjustingScrollPosition;
	}
	/**
	 * Gets the original non-patched prototype method for the given kind
	 * @param {ScrollMethodName} kind
	 * @param {Element|Window} element
	 * @return {Function}
	 */
	function getOriginalScrollMethodForKind(kind, element) {
		switch (kind) {
			case "scroll":
				if (element instanceof Element) {
					if (ELEMENT_ORIGINAL_SCROLL != null) {
						return ELEMENT_ORIGINAL_SCROLL;
					} else {
						return elementPrototypeScrollFallback;
					}
				} else {
					return WINDOW_ORIGINAL_SCROLL;
				}
			case "scrollBy":
				if (element instanceof Element) {
					if (ELEMENT_ORIGINAL_SCROLL_BY != null) {
						return ELEMENT_ORIGINAL_SCROLL_BY;
					} else {
						return elementPrototypeScrollByFallback;
					}
				} else {
					return WINDOW_ORIGINAL_SCROLL_BY;
				}
			case "scrollTo":
				if (element instanceof Element) {
					if (ELEMENT_ORIGINAL_SCROLL_TO != null) {
						return ELEMENT_ORIGINAL_SCROLL_TO;
					} else {
						return elementPrototypeScrollToFallback;
					}
				} else {
					return WINDOW_ORIGINAL_SCROLL_TO;
				}
		}
	}

	/**
	 * Gets the Smooth Scroll Options to use for the step function
	 * @param {Element|Window} element
	 * @param {number} x
	 * @param {number} y
	 * @param {ScrollMethodName} kind
	 * @returns {ISmoothScrollOptions}
	 */
	function getSmoothScrollOptions(element, x, y, kind) {
		var startTime = now();
		if (!(element instanceof Element)) {
			// Use window as the scroll container
			var scrollX_1 = window.scrollX,
				pageXOffset_1 = window.pageXOffset,
				scrollY_1 = window.scrollY,
				pageYOffset_1 = window.pageYOffset;
			var startX = scrollX_1 == null || scrollX_1 === 0 ? pageXOffset_1 : scrollX_1;
			var startY = scrollY_1 == null || scrollY_1 === 0 ? pageYOffset_1 : scrollY_1;
			return {
				startTime: startTime,
				startX: startX,
				startY: startY,
				endX: Math.floor(kind === "scrollBy" ? startX + x : x),
				endY: Math.floor(kind === "scrollBy" ? startY + y : y),
				method: getOriginalScrollMethodForKind("scrollTo", window).bind(window),
				scroller: getScrollingElement()
			};
		} else {
			var scrollLeft = element.scrollLeft,
				scrollTop = element.scrollTop;
			var startX = scrollLeft;
			var startY = scrollTop;
			return {
				startTime: startTime,
				startX: startX,
				startY: startY,
				endX: Math.floor(kind === "scrollBy" ? startX + x : x),
				endY: Math.floor(kind === "scrollBy" ? startY + y : y),
				method: getOriginalScrollMethodForKind("scrollTo", element).bind(element),
				scroller: element
			};
		}
	}

	/**
	 * Ensures that the given value is numeric
	 * @param {number} value
	 * @return {number}
	 */
	function ensureNumeric(value) {
		if (value == null) return 0;
		else if (typeof value === "number") {
			return value;
		} else if (typeof value === "string") {
			return parseFloat(value);
		} else {
			return 0;
		}
	}

	/**
	 * Returns true if the given value is some ScrollToOptions
	 * @param {number | ScrollToOptions} value
	 * @return {value is ScrollToOptions}
	 */
	function isScrollToOptions(value) {
		return value != null && typeof value === "object";
	}

	/**
	 * Handles a scroll method
	 * @param {Element|Window} element
	 * @param {ScrollMethodName} kind
	 * @param {number | ScrollToOptions} optionsOrX
	 * @param {number} y
	 */
	function handleScrollMethod(element, kind, optionsOrX, y) {
		onScrollWithOptions(getScrollToOptionsWithValidation(optionsOrX, y), element, kind);
	}
	/**
	 * Invoked when a 'ScrollToOptions' dict is provided to 'scroll()' as the first argument
	 * @param {ScrollToOptions} options
	 * @param {Element|Window} element
	 * @param {ScrollMethodName} kind
	 */
	function onScrollWithOptions(options, element, kind) {
		var behavior = getScrollBehavior(element, options);
		// If the behavior is 'auto' apply instantaneous scrolling
		if (behavior == null || behavior === "auto") {
			getOriginalScrollMethodForKind(kind, element).call(element, options.left, options.top);
		} else {
			smoothScroll(getSmoothScrollOptions(element, options.left, options.top, kind));
		}
	}
	/**
	 * Normalizes the given scroll coordinates
	 * @param {number?} x
	 * @param {number?} y
	 * @return {Required<Pick<ScrollToOptions, "top" | "left">>}
	 */
	function normalizeScrollCoordinates(x, y) {
		return {
			left: ensureNumeric(x),
			top: ensureNumeric(y)
		};
	}
	/**
	 * Gets ScrollToOptions based on the given arguments. Will throw if validation fails
	 * @param {number | ScrollToOptions} optionsOrX
	 * @param {number} y
	 * @return {Required<ScrollToOptions>}
	 */
	function getScrollToOptionsWithValidation(optionsOrX, y) {
		// If only one argument is given, and it isn't an options object, throw a TypeError
		if (y === undefined && !isScrollToOptions(optionsOrX)) {
			throw new TypeError("Failed to execute 'scroll' on 'Element': parameter 1 ('options') is not an object.");
		}
		// Scroll based on the primitive values given as arguments
		if (!isScrollToOptions(optionsOrX)) {
			return __assign(__assign({}, normalizeScrollCoordinates(optionsOrX, y)), {behavior: "auto"});
		}
		// Scroll based on the received options object
		else {
			return __assign(__assign({}, normalizeScrollCoordinates(optionsOrX.left, optionsOrX.top)), {
				behavior: optionsOrX.behavior == null ? "auto" : optionsOrX.behavior
			});
		}
	}

	/**
	 * Patches the 'scroll' method on the Element prototype
	 */
	function patchElementScroll() {
		Element.prototype.scroll = function(optionsOrX, y) {
			handleScrollMethod(this, "scroll", optionsOrX, y);
		};
	}

	/**
	 * Patches the 'scrollBy' method on the Element prototype
	 */
	function patchElementScrollBy() {
		Element.prototype.scrollBy = function(optionsOrX, y) {
			handleScrollMethod(this, "scrollBy", optionsOrX, y);
		};
	}

	/**
	 * Patches the 'scrollTo' method on the Element prototype
	 */
	function patchElementScrollTo() {
		Element.prototype.scrollTo = function(optionsOrX, y) {
			handleScrollMethod(this, "scrollTo", optionsOrX, y);
		};
	}

	/**
	 * Patches the 'scroll' method on the Window prototype
	 */
	function patchWindowScroll() {
		window.scroll = function(optionsOrX, y) {
			handleScrollMethod(this, "scroll", optionsOrX, y);
		};
	}

	/**
	 * Patches the 'scrollBy' method on the Window prototype
	 */
	function patchWindowScrollBy() {
		window.scrollBy = function(optionsOrX, y) {
			handleScrollMethod(this, "scrollBy", optionsOrX, y);
		};
	}

	/**
	 * Patches the 'scrollTo' method on the Window prototype
	 */
	function patchWindowScrollTo() {
		window.scrollTo = function(optionsOrX, y) {
			handleScrollMethod(this, "scrollTo", optionsOrX, y);
		};
	}

	// tslint:disable:no-any
	/**
	 * Gets the parent of an element, taking into account DocumentFragments, ShadowRoots, as well as the root context (window)
	 * @param {EventTarget} currentElement
	 * @returns {EventTarget | null}
	 */
	function getParent(currentElement) {
		if ("nodeType" in currentElement && currentElement.nodeType === 1) {
			return currentElement.parentNode;
		}
		if ("ShadowRoot" in window && currentElement instanceof window.ShadowRoot) {
			return currentElement.host;
		} else if (currentElement === document) {
			return window;
		} else if (currentElement instanceof Node) return currentElement.parentNode;
		return null;
	}

	/**
	 * Returns true if the given overflow property represents a scrollable overflow value
	 * @param {string | null} overflow
	 * @return {boolean}
	 */
	function canOverflow(overflow) {
		return overflow !== "visible" && overflow !== "clip";
	}
	/**
	 * Returns true if the given element is scrollable
	 * @param {Element} element
	 * @return {boolean}
	 */
	function isScrollable(element) {
		if (element.clientHeight < element.scrollHeight || element.clientWidth < element.scrollWidth) {
			var style = getComputedStyle(element, null);
			return canOverflow(style.overflowY) || canOverflow(style.overflowX);
		}
		return false;
	}
	/**
	 * Finds the nearest ancestor of an element that can scroll
	 * @param {Element} target
	 * @returns {Element|Window?}
	 */
	function findNearestAncestorsWithScrollBehavior(target) {
		var currentElement = target;
		var scrollingElement = getScrollingElement();
		while (currentElement != null) {
			var behavior = getScrollBehavior(currentElement);
			if (behavior != null && (currentElement === scrollingElement || isScrollable(currentElement))) {
				return [currentElement, behavior];
			}
			var parent_1 = getParent(currentElement);
			currentElement = parent_1;
		}
		// No such element could be found. Start over, but this time find the nearest ancestor that can simply scroll
		currentElement = target;
		while (currentElement != null) {
			if (currentElement === scrollingElement || isScrollable(currentElement)) {
				return [currentElement, "auto"];
			}
			var parent_2 = getParent(currentElement);
			currentElement = parent_2;
		}
		// Default to the scrolling element
		return [scrollingElement, "auto"];
	}

	// tslint:disable:no-any
	/**
	 * Finds the nearest root from an element
	 * @param {Element} target
	 * @returns {Document|ShadowRoot}
	 */
	function findNearestRoot(target) {
		var currentElement = target;
		while (currentElement != null) {
			if ("ShadowRoot" in window && currentElement instanceof window.ShadowRoot) {
				// Assume this is a ShadowRoot
				return currentElement;
			}
			var parent_1 = getParent(currentElement);
			if (parent_1 === currentElement) {
				return document;
			}
			currentElement = parent_1;
		}
		return document;
	}

	/**
	 * Gets the origin of the given Location or HTMLAnchorElement if available in the runtime, and otherwise shims it. (it's a one-liner)
	 * @returns {string}
	 */
	function getLocationOrigin(locationLike) {
		if (locationLike === void 0) {
			locationLike = location;
		}
		if ("origin" in locationLike && locationLike.origin != null) {
			return locationLike.origin;
		}
		var port = locationLike.port != null && locationLike.port.length > 0 ? ":" + locationLike.port : "";
		if (locationLike.protocol === "http:" && port === ":80") {
			port = "";
		} else if (locationLike.protocol === "https:" && port === ":443") {
			port = "";
		}
		return locationLike.protocol + "//" + locationLike.hostname + port;
	}

	/**
	 * A Regular expression that matches id's of the form "#[digit]"
	 * @type {RegExp}
	 */
	var ID_WITH_LEADING_DIGIT_REGEXP = /^#\d/;
	/**
	 * Catches anchor navigation to IDs within the same root and ensures that they can be smooth-scrolled
	 * if the scroll behavior is smooth in the first rooter within that context
	 */
	function catchNavigation() {
		// Listen for 'click' events globally
		window.addEventListener("click", function(e) {
			// Only work with trusted events on HTMLAnchorElements
			if (!e.isTrusted || !(e.target instanceof HTMLAnchorElement)) return;
			var _a = e.target,
				pathname = _a.pathname,
				search = _a.search,
				hash = _a.hash;
			var pointsToCurrentPage =
				getLocationOrigin(e.target) === getLocationOrigin(location) && pathname === location.pathname && search === location.search;
			// Only work with HTMLAnchorElements that navigates to a specific ID on the current page
			if (!pointsToCurrentPage || hash == null || hash.length < 1) {
				return;
			}
			// Find the nearest root, whether it be a ShadowRoot or the document itself
			var root = findNearestRoot(e.target);
			// Attempt to match the selector from that root. querySelector' doesn't support IDs that start with a digit, so work around that limitation
			var elementMatch = hash.match(ID_WITH_LEADING_DIGIT_REGEXP) != null ? root.getElementById(hash.slice(1)) : root.querySelector(hash);
			// If no selector could be found, don't proceed
			if (elementMatch == null) return;
			// Find the nearest ancestor that can be scrolled
			var _b = __read(findNearestAncestorsWithScrollBehavior(elementMatch), 2),
				behavior = _b[1];
			// If the behavior isn't smooth, don't proceed
			if (behavior !== "smooth") return;
			// Otherwise, first prevent the default action.
			e.preventDefault();
			// Now, scroll to the element with that ID
			elementMatch.scrollIntoView({
				behavior: behavior
			});
		});
	}

	var ELEMENT_ORIGINAL_SCROLL_INTO_VIEW = UNSUPPORTED_ENVIRONMENT ? undefined : Element.prototype.scrollIntoView;

	/**
	 * The majority of this file is based on https://github.com/stipsan/compute-scroll-into-view (MIT license),
	 * but has been rewritten to accept a scroller as an argument.
	 */
	/**
	 * Find out which edge to align against when logical scroll position is "nearest"
	 * Interesting fact: "nearest" works similarly to "if-needed", if the element is fully visible it will not scroll it
	 *
	 * Legends:
	 * ┌────────┐ ┏ ━ ━ ━ ┓
	 * │ target │   frame
	 * └────────┘ ┗ ━ ━ ━ ┛
	 */
	function alignNearest(
		scrollingEdgeStart,
		scrollingEdgeEnd,
		scrollingSize,
		scrollingBorderStart,
		scrollingBorderEnd,
		elementEdgeStart,
		elementEdgeEnd,
		elementSize
	) {
		/**
		 * If element edge A and element edge B are both outside scrolling box edge A and scrolling box edge B
		 *
		 *          ┌──┐
		 *        ┏━│━━│━┓
		 *          │  │
		 *        ┃ │  │ ┃        do nothing
		 *          │  │
		 *        ┗━│━━│━┛
		 *          └──┘
		 *
		 *  If element edge C and element edge D are both outside scrolling box edge C and scrolling box edge D
		 *
		 *    ┏ ━ ━ ━ ━ ┓
		 *   ┌───────────┐
		 *   │┃         ┃│        do nothing
		 *   └───────────┘
		 *    ┗ ━ ━ ━ ━ ┛
		 */
		if (
			(elementEdgeStart < scrollingEdgeStart && elementEdgeEnd > scrollingEdgeEnd) ||
			(elementEdgeStart > scrollingEdgeStart && elementEdgeEnd < scrollingEdgeEnd)
		) {
			return 0;
		}
		/**
		 * If element edge A is outside scrolling box edge A and element height is less than scrolling box height
		 *
		 *          ┌──┐
		 *        ┏━│━━│━┓         ┏━┌━━┐━┓
		 *          └──┘             │  │
		 *  from  ┃      ┃     to  ┃ └──┘ ┃
		 *
		 *        ┗━ ━━ ━┛         ┗━ ━━ ━┛
		 *
		 * If element edge B is outside scrolling box edge B and element height is greater than scrolling box height
		 *
		 *        ┏━ ━━ ━┓         ┏━┌━━┐━┓
		 *                           │  │
		 *  from  ┃ ┌──┐ ┃     to  ┃ │  │ ┃
		 *          │  │             │  │
		 *        ┗━│━━│━┛         ┗━│━━│━┛
		 *          │  │             └──┘
		 *          │  │
		 *          └──┘
		 *
		 * If element edge C is outside scrolling box edge C and element width is less than scrolling box width
		 *
		 *       from                 to
		 *    ┏ ━ ━ ━ ━ ┓         ┏ ━ ━ ━ ━ ┓
		 *  ┌───┐                 ┌───┐
		 *  │ ┃ │       ┃         ┃   │     ┃
		 *  └───┘                 └───┘
		 *    ┗ ━ ━ ━ ━ ┛         ┗ ━ ━ ━ ━ ┛
		 *
		 * If element edge D is outside scrolling box edge D and element width is greater than scrolling box width
		 *
		 *       from                 to
		 *    ┏ ━ ━ ━ ━ ┓         ┏ ━ ━ ━ ━ ┓
		 *        ┌───────────┐   ┌───────────┐
		 *    ┃   │     ┃     │   ┃         ┃ │
		 *        └───────────┘   └───────────┘
		 *    ┗ ━ ━ ━ ━ ┛         ┗ ━ ━ ━ ━ ┛
		 */
		if (
			(elementEdgeStart <= scrollingEdgeStart && elementSize <= scrollingSize) ||
			(elementEdgeEnd >= scrollingEdgeEnd && elementSize >= scrollingSize)
		) {
			return elementEdgeStart - scrollingEdgeStart - scrollingBorderStart;
		}
		/**
		 * If element edge B is outside scrolling box edge B and element height is less than scrolling box height
		 *
		 *        ┏━ ━━ ━┓         ┏━ ━━ ━┓
		 *
		 *  from  ┃      ┃     to  ┃ ┌──┐ ┃
		 *          ┌──┐             │  │
		 *        ┗━│━━│━┛         ┗━└━━┘━┛
		 *          └──┘
		 *
		 * If element edge A is outside scrolling box edge A and element height is greater than scrolling box height
		 *
		 *          ┌──┐
		 *          │  │
		 *          │  │             ┌──┐
		 *        ┏━│━━│━┓         ┏━│━━│━┓
		 *          │  │             │  │
		 *  from  ┃ └──┘ ┃     to  ┃ │  │ ┃
		 *                           │  │
		 *        ┗━ ━━ ━┛         ┗━└━━┘━┛
		 *
		 * If element edge C is outside scrolling box edge C and element width is greater than scrolling box width
		 *
		 *           from                 to
		 *        ┏ ━ ━ ━ ━ ┓         ┏ ━ ━ ━ ━ ┓
		 *  ┌───────────┐           ┌───────────┐
		 *  │     ┃     │   ┃       │ ┃         ┃
		 *  └───────────┘           └───────────┘
		 *        ┗ ━ ━ ━ ━ ┛         ┗ ━ ━ ━ ━ ┛
		 *
		 * If element edge D is outside scrolling box edge D and element width is less than scrolling box width
		 *
		 *           from                 to
		 *        ┏ ━ ━ ━ ━ ┓         ┏ ━ ━ ━ ━ ┓
		 *                ┌───┐             ┌───┐
		 *        ┃       │ ┃ │       ┃     │   ┃
		 *                └───┘             └───┘
		 *        ┗ ━ ━ ━ ━ ┛         ┗ ━ ━ ━ ━ ┛
		 *
		 */
		if (
			(elementEdgeEnd > scrollingEdgeEnd && elementSize < scrollingSize) ||
			(elementEdgeStart < scrollingEdgeStart && elementSize > scrollingSize)
		) {
			return elementEdgeEnd - scrollingEdgeEnd + scrollingBorderEnd;
		}
		return 0;
	}
	function computeScrollIntoView(target, scroller, options) {
		var block = options.block,
			inline = options.inline;
		// Used to handle the top most element that can be scrolled
		var scrollingElement = getScrollingElement();
		// Support pinch-zooming properly, making sure elements scroll into the visual viewport
		// Browsers that don't support visualViewport will report the layout viewport dimensions on document.documentElement.clientWidth/Height
		// and viewport dimensions on window.innerWidth/Height
		// https://www.quirksmode.org/mobile/viewports2.html
		// https://bokand.github.io/viewport/index.html
		var viewportWidth = window.visualViewport != null ? visualViewport.width : innerWidth;
		var viewportHeight = window.visualViewport != null ? visualViewport.height : innerHeight;
		var viewportX = window.scrollX != null ? window.scrollX : window.pageXOffset;
		var viewportY = window.scrollY != null ? window.scrollY : window.pageYOffset;
		var _a = target.getBoundingClientRect(),
			targetHeight = _a.height,
			targetWidth = _a.width,
			targetTop = _a.top,
			targetRight = _a.right,
			targetBottom = _a.bottom,
			targetLeft = _a.left;
		// These values mutate as we loop through and generate scroll coordinates
		var targetBlock = block === "start" || block === "nearest" ? targetTop : block === "end" ? targetBottom : targetTop + targetHeight / 2; // block === 'center
		var targetInline = inline === "center" ? targetLeft + targetWidth / 2 : inline === "end" ? targetRight : targetLeft; // inline === 'start || inline === 'nearest
		var _b = scroller.getBoundingClientRect(),
			height = _b.height,
			width = _b.width,
			top = _b.top,
			right = _b.right,
			bottom = _b.bottom,
			left = _b.left;
		var frameStyle = getComputedStyle(scroller);
		var borderLeft = parseInt(frameStyle.borderLeftWidth, 10);
		var borderTop = parseInt(frameStyle.borderTopWidth, 10);
		var borderRight = parseInt(frameStyle.borderRightWidth, 10);
		var borderBottom = parseInt(frameStyle.borderBottomWidth, 10);
		var blockScroll = 0;
		var inlineScroll = 0;
		// The property existance checks for offset[Width|Height] is because only HTMLElement objects have them, but any Element might pass by here
		// @TODO find out if the "as HTMLElement" overrides can be dropped
		var scrollbarWidth = "offsetWidth" in scroller ? scroller.offsetWidth - scroller.clientWidth - borderLeft - borderRight : 0;
		var scrollbarHeight = "offsetHeight" in scroller ? scroller.offsetHeight - scroller.clientHeight - borderTop - borderBottom : 0;
		if (scrollingElement === scroller) {
			// Handle viewport logic (document.documentElement or document.body)
			if (block === "start") {
				blockScroll = targetBlock;
			} else if (block === "end") {
				blockScroll = targetBlock - viewportHeight;
			} else if (block === "nearest") {
				blockScroll = alignNearest(
					viewportY,
					viewportY + viewportHeight,
					viewportHeight,
					borderTop,
					borderBottom,
					viewportY + targetBlock,
					viewportY + targetBlock + targetHeight,
					targetHeight
				);
			} else {
				// block === 'center' is the default
				blockScroll = targetBlock - viewportHeight / 2;
			}
			if (inline === "start") {
				inlineScroll = targetInline;
			} else if (inline === "center") {
				inlineScroll = targetInline - viewportWidth / 2;
			} else if (inline === "end") {
				inlineScroll = targetInline - viewportWidth;
			} else {
				// inline === 'nearest' is the default
				inlineScroll = alignNearest(
					viewportX,
					viewportX + viewportWidth,
					viewportWidth,
					borderLeft,
					borderRight,
					viewportX + targetInline,
					viewportX + targetInline + targetWidth,
					targetWidth
				);
			}
			// Apply scroll position offsets and ensure they are within bounds
			// @TODO add more test cases to cover this 100%
			blockScroll = Math.max(0, blockScroll + viewportY);
			inlineScroll = Math.max(0, inlineScroll + viewportX);
		} else {
			// Handle each scrolling frame that might exist between the target and the viewport
			if (block === "start") {
				blockScroll = targetBlock - top - borderTop;
			} else if (block === "end") {
				blockScroll = targetBlock - bottom + borderBottom + scrollbarHeight;
			} else if (block === "nearest") {
				blockScroll = alignNearest(
					top,
					bottom,
					height,
					borderTop,
					borderBottom + scrollbarHeight,
					targetBlock,
					targetBlock + targetHeight,
					targetHeight
				);
			} else {
				// block === 'center' is the default
				blockScroll = targetBlock - (top + height / 2) + scrollbarHeight / 2;
			}
			if (inline === "start") {
				inlineScroll = targetInline - left - borderLeft;
			} else if (inline === "center") {
				inlineScroll = targetInline - (left + width / 2) + scrollbarWidth / 2;
			} else if (inline === "end") {
				inlineScroll = targetInline - right + borderRight + scrollbarWidth;
			} else {
				// inline === 'nearest' is the default
				inlineScroll = alignNearest(
					left,
					right,
					width,
					borderLeft,
					borderRight + scrollbarWidth,
					targetInline,
					targetInline + targetWidth,
					targetWidth
				);
			}
			var scrollLeft = scroller.scrollLeft,
				scrollTop = scroller.scrollTop;
			// Ensure scroll coordinates are not out of bounds while applying scroll offsets
			blockScroll = Math.max(0, Math.min(scrollTop + blockScroll, scroller.scrollHeight - height + scrollbarHeight));
			inlineScroll = Math.max(0, Math.min(scrollLeft + inlineScroll, scroller.scrollWidth - width + scrollbarWidth));
		}
		return {
			top: blockScroll,
			left: inlineScroll
		};
	}

	/**
	 * Patches the 'scrollIntoView' method on the Element prototype
	 */
	function patchElementScrollIntoView() {
		Element.prototype.scrollIntoView = function(arg) {
			var normalizedOptions =
				arg == null || arg === true
					? {
							block: "start",
							inline: "nearest"
					  }
					: arg === false
					? {
							block: "end",
							inline: "nearest"
					  }
					: arg;
			// Find the nearest ancestor that can be scrolled
			var _a = __read(findNearestAncestorsWithScrollBehavior(this), 2),
				ancestorWithScroll = _a[0],
				ancestorWithScrollBehavior = _a[1];
			var behavior = normalizedOptions.behavior != null ? normalizedOptions.behavior : ancestorWithScrollBehavior;
			// If the behavior isn't smooth, simply invoke the original implementation and do no more
			if (behavior !== "smooth") {
				// Assert that 'scrollIntoView' is actually defined
				if (ELEMENT_ORIGINAL_SCROLL_INTO_VIEW != null) {
					ELEMENT_ORIGINAL_SCROLL_INTO_VIEW.call(this, normalizedOptions);
				}
				// Otherwise, invoke 'scrollTo' instead and provide the scroll coordinates
				else {
					var _b = computeScrollIntoView(this, ancestorWithScroll, normalizedOptions),
						top_1 = _b.top,
						left = _b.left;
					getOriginalScrollMethodForKind("scrollTo", this).call(this, left, top_1);
				}
				return;
			}
			ancestorWithScroll.scrollTo(__assign({behavior: behavior}, computeScrollIntoView(this, ancestorWithScroll, normalizedOptions)));
		};
		// On IE11, HTMLElement has its own declaration of scrollIntoView and does not inherit this from the prototype chain, so we'll need to patch that one too.
		if (HTMLElement.prototype.scrollIntoView != null && HTMLElement.prototype.scrollIntoView !== Element.prototype.scrollIntoView) {
			HTMLElement.prototype.scrollIntoView = Element.prototype.scrollIntoView;
		}
	}

	var s = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
	var ELEMENT_ORIGINAL_SCROLL_TOP_SET_DESCRIPTOR = UNSUPPORTED_ENVIRONMENT || typeof s === "undefined" ? undefined : s.set;

	/**
	 * Patches the 'scrollTop' property descriptor on the Element prototype
	 */
	function patchElementScrollTop() {
		Object.defineProperty(Element.prototype, "scrollTop", {
			set: function(scrollTop) {
				if (this.__adjustingScrollPosition) {
					return ELEMENT_ORIGINAL_SCROLL_TOP_SET_DESCRIPTOR.call(this, scrollTop);
				}
				handleScrollMethod(this, "scrollTo", this.scrollLeft, scrollTop);
				return scrollTop;
			}
		});
	}

	var s$1 = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
	var ELEMENT_ORIGINAL_SCROLL_LEFT_SET_DESCRIPTOR = UNSUPPORTED_ENVIRONMENT || typeof s$1 === "undefined" ? undefined : s$1.set;

	/**
	 * Patches the 'scrollLeft' property descriptor on the Element prototype
	 */
	function patchElementScrollLeft() {
		Object.defineProperty(Element.prototype, "scrollLeft", {
			set: function(scrollLeft) {
				if (this.__adjustingScrollPosition) {
					return ELEMENT_ORIGINAL_SCROLL_LEFT_SET_DESCRIPTOR.call(this, scrollLeft);
				}
				handleScrollMethod(this, "scrollTo", scrollLeft, this.scrollTop);
				return scrollLeft;
			}
		});
	}

	/**
	 * Applies the polyfill
	 */
	function patch() {
		// Element.prototype methods
		patchElementScroll();
		patchElementScrollBy();
		patchElementScrollTo();
		patchElementScrollIntoView();
		// Element.prototype descriptors
		patchElementScrollLeft();
		patchElementScrollTop();
		// window methods
		patchWindowScroll();
		patchWindowScrollBy();
		patchWindowScrollTo();
		// Navigation
		catchNavigation();
	}

	/**
	 * Is true if the browser natively supports the Element.prototype.[scroll|scrollTo|scrollBy|scrollIntoView] methods
	 * @type {boolean}
	 */
	var SUPPORTS_ELEMENT_PROTOTYPE_SCROLL_METHODS = UNSUPPORTED_ENVIRONMENT
		? false
		: "scroll" in Element.prototype && "scrollTo" in Element.prototype && "scrollBy" in Element.prototype && "scrollIntoView" in Element.prototype;

	if (!UNSUPPORTED_ENVIRONMENT && (!SUPPORTS_SCROLL_BEHAVIOR || !SUPPORTS_ELEMENT_PROTOTYPE_SCROLL_METHODS)) {
		patch();
	}
})();
//# sourceMappingURL=index.js.map
