/*
 Copyright (C) 2018 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

import {DESTINATION_UNMAPPED} from '../../events/eventTypes';

(function (can, GGRC, CMS) {
  'use strict';

  let defaultType = 'Relationship';

  GGRC.Components('unmapButton', {
    tag: 'unmap-button',
    viewModel: {
      mappingType: '@',
      objectProp: '@',
      destination: {},
      source: {},
      isUnmapping: false,
      preventClick: false,
      unmapInstance: function () {
        this.attr('isUnmapping', true);
        this.dispatch({type: 'beforeUnmap', item: this.attr('source')});
        this.getMapping()
          .refresh()
          .done((item) => {
            item.destroy()
              .then(() => {
                this.dispatch('unmapped');
                this.attr('destination').dispatch('refreshInstance');
                this.attr('destination').dispatch(DESTINATION_UNMAPPED);
                this.dispatch('afterUnmap');
              })
              .always(() => {
                this.attr('isUnmapping', false);
              });
          })
          .fail(() => {
            this.attr('isUnmapping', false);
          });
      },
      getMapping: function () {
        let type = this.attr('mappingType') || defaultType;
        let destinations;
        let sources;
        let mapping;
        if (type === defaultType) {
          destinations = this.attr('destination.related_destinations')
          .concat(this.attr('destination.related_sources'));
          sources = this.attr('source.related_destinations')
          .concat(this.attr('source.related_sources'));
        } else {
          destinations = this.attr('destination')
              .attr(this.attr('objectProp')) || [];
          sources = this.attr('source')
              .attr(this.attr('objectProp')) || [];
        }
        sources = sources
          .map(function (item) {
            return item.id;
          });
        mapping = destinations
          .filter(function (dest) {
            return sources.indexOf(dest.id) > -1;
          })[0];
        return new CMS.Models[type](mapping || {});
      },
    },
    events: {
      click: function () {
        if (this.viewModel.attr('preventClick')) {
          return;
        }

        this.viewModel.unmapInstance();
      },
    },
  });
})(window.can, window.GGRC, window.CMS);
