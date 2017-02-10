/*!
 Copyright (C) 2017 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

(function (can, GGRC) {
  'use strict';

  var template = can.view(GGRC.mustache_path +
    '/components/tree/tree-node-actions.mustache');

  can.Component.extend({
    tag: 'tree-node-actions',
    template: template,
    viewModel: {
      instance: null,
      childOptions: null,
      drawRoles: false,
      drawStates: false,
      drawRelatedAssessment: false,
      state: {
        open: false
      },
      modalTitle: 'Related Assessments',
      showRelatedAssessments: function () {
        this.attr('state.open', true);
      }
    }
  });
})(window.can, window.GGRC);
