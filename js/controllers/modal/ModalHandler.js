/*global pkp */
/**
 * @defgroup js_controllers_modal
 */
/**
 * @file js/controllers/modal/ModalHandler.js
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2000-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class ModalHandler
 * @ingroup js_controllers_modal
 *
 * @brief Basic modal implementation.
 *
 *  A modal that has only one button and expects a simple message string.
 */
(function($) {

	/** @type {Object} */
	$.pkp.controllers.modal = $.pkp.controllers.modal || { };



	/**
	 * @constructor
	 *
	 * @extends $.pkp.classes.Handler
	 *
	 * @param {jQueryObject} $handledElement The modal.
	 * @param {Object.<string, *>} options The modal options.
	 */
	$.pkp.controllers.modal.ModalHandler = function($handledElement, options) {
		this.parent($handledElement, options);

		// Check the options.
		if (!this.checkOptions(options)) {
			throw new Error('Missing or invalid modal options!');
		}

		// Clone the options object before we manipulate them.
		var internalOptions = $.extend(true, {}, options),
				canClose;

		// Merge user and default options.
		this.options = /** @type {{ canClose: boolean, textTitle: string,
				title: string, titleIcon: string,
				closeCleanVueInstances: Array }} */
				(this.mergeOptions(internalOptions));

		// Open the modal
		this.modalOpen($handledElement);

		// Publish some otherwise private events triggered
		// by nested widgets so that they can be handled by
		// the element that opened the modal.
		this.publishEvent('redirectRequested');
		this.publishEvent('dataChanged');
		this.publishEvent('updateHeader');
		this.publishEvent('gridRefreshRequested');

		this.bind('notifyUser', this.redirectNotifyUserEventHandler_);
		this.bindGlobal('form-success', this.onFormSuccess_);
	};
	$.pkp.classes.Helper.inherits($.pkp.controllers.modal.ModalHandler,
			$.pkp.classes.Handler);


	//
	// Private static properties
	//
	/**
	 * Default options
	 * @private
	 * @type {Object}
	 * @const
	 */
	$.pkp.controllers.modal.ModalHandler.DEFAULT_OPTIONS_ = {
		autoOpen: true,
		width: 710,
		modal: true,
		draggable: false,
		resizable: false,
		position: {my: 'center', at: 'center center-10%', of: window},
		canClose: true,
		closeCallback: false,
		// Vue components to destroy when when modal is closed
		closeCleanVueInstances: []
	};


	//
	// Public properties
	//
	/**
	 * Current options
	 *
	 * After passed options are merged with defaults.
	 *
	 * @type {Object}
	 */
	$.pkp.controllers.modal.ModalHandler.options = null;


	//
	// Protected methods
	//
	/**
	 * Check whether the correct options have been
	 * given for this modal.
	 * @protected
	 * @param {Object.<string, *>} options Modal options.
	 * @return {boolean} True if options are ok.
	 */
	$.pkp.controllers.modal.ModalHandler.prototype.checkOptions =
			function(options) {

		// Check for basic configuration requirements.
		return typeof options === 'object' &&
				(/** @type {{ buttons: Object }} */ (options)).buttons === undefined;
	};


	/**
	 * Determine the options based on
	 * default options.
	 * @protected
	 * @param {Object.<string, *>} options Non-default modal options.
	 * @return {Object.<string, *>} The default options merged
	 *  with the non-default options.
	 */
	$.pkp.controllers.modal.ModalHandler.prototype.mergeOptions =
			function(options) {

		// Merge the user options into the default options.
		var mergedOptions = $.extend(true, { },
				this.self('DEFAULT_OPTIONS_'), options);
		return mergedOptions;
	};

	/**
	 * Attach a modal to the dom and make it visible
	 * @param {jQueryObject} $handledElement The modal.
	 */
	$.pkp.controllers.modal.ModalHandler.prototype.modalOpen =
			function($handledElement) {

		this.uniqueModalId = "id" + Math.random().toString(16).slice(2)

		// Trigger events
		$handledElement.trigger('pkpModalOpen', [$handledElement]);
	};


	/**
	 * Close the modal. Typically invoked via an event of some kind, such as
	 * a `click` or `keyup`
	 *
	 * @param {Object=} opt_callingContext The calling element or object.
	 * @param {Event=} opt_event The triggering event (e.g. a click on
	 *  a close button. Not set if called via callback.
	 * @return {boolean} Should return false to stop event processing.
	 */
	$.pkp.controllers.modal.ModalHandler.prototype.modalClose =
			function(opt_callingContext, opt_event) {

		var modalHandler = this,
				$modalElement = this.getHtmlElement(),
				$form = $modalElement.find('form').first(),
				handler, informationObject;


		// Hide the modal, clean up any mounted vue instances, remove it from the
		// DOM and remove the handler once the CSS animation is complete
		this.trigger('pkpModalClose');
		if (this.dialogProps) {
			pkp.eventBus.$emit('close-dialog-vue');
		} else {
			pkp.eventBus.$emit('close-modal-vue', {modalId: this.uniqueModalId});
		}
		setTimeout(function() {
			var vueInstances = modalHandler.options.closeCleanVueInstances,
					instance,
					i,
					id;
			if (vueInstances.length) {
				for (i = 0; i < vueInstances.length; i++) {
					id = vueInstances[i];
					if (typeof pkp.registry._instances[id] !== 'undefined') {
						instance = /** @type {{ $destroy: Function }} */
								(pkp.registry._instances[id]);
						instance.unmount();
					}
				}
			}
			modalHandler.unbindPartial($modalElement);
			$modalElement.empty();
			modalHandler.remove();
			// Fire a callback function if one has been passed with options
			if (typeof modalHandler.options.closeCallback === 'function') {
				modalHandler.options.closeCallback.call();
			}
		}, 300);


		return false;
	};


	/**
	 * Process events that reach the wrapper element.
	 * Should NOT block other events from bubbling up. Doing so
	 * can disable submit buttons in nested forms.
	 *
	 * @param {Object=} opt_callingContext The calling element or object.
	 * @param {Event=} opt_event The triggering event (e.g. a click on
	 *  a close button. Not set if called via callback.
	 */
	$.pkp.controllers.modal.ModalHandler.prototype.handleWrapperEvents =
			function(opt_callingContext, opt_event) {

		// Close click events directly on modal (background screen)
		if (opt_event.type == 'click' && opt_callingContext == opt_event.target) {
			$.pkp.classes.Handler.getHandler($(opt_callingContext))
					.modalClose();
			return;
		}

		// Close for ESC keypresses (27) that have bubbled up
		if (opt_event.type == 'keyup' && opt_event.which == 27) {
			$.pkp.classes.Handler.getHandler($(opt_callingContext))
					.modalClose();
			return;
		}
	};


	//
	// Private methods
	//
	/**
	 * Handler to redirect to the correct notification widget the
	 * notify user event.
	 * @param {HTMLElement} sourceElement The element that issued the
	 * "notifyUser" event.
	 * @param {Event} event The "notify user" event.
	 * @param {HTMLElement} triggerElement The element that triggered
	 * the "notifyUser" event.
	 * @private
	 */
	$.pkp.controllers.modal.ModalHandler.prototype.redirectNotifyUserEventHandler_ =
			function(sourceElement, event, triggerElement) {

		// Use the notification helper to redirect the notify user event.
		$.pkp.classes.notification.NotificationHelper.
				redirectNotifyUserEvent(this, triggerElement);
	};


	/**
	 * Handler to listen to global form success events, and close when an event
	 * from a child form has been fired, and this form matches the config id
	 *
	 * @param {Object} source The Vue.js component which fired the event
	 * @param {Object} formId The form component's id prop
	 * @private
	 */
	$.pkp.controllers.modal.ModalHandler.prototype.onFormSuccess_ =
			function(source, formId) {
		if (this.options.closeOnFormSuccessId &&
				this.options.closeOnFormSuccessId === formId) {
			var self = this;
			pkp.eventBus.$emit('close-modal-vue-soon', {modalId: this.uniqueModalId});

			setTimeout(function() {
				self.modalClose();
			}, 1500);
		}
	};


})(jQuery);
