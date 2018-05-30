/*
    Copyright (C) 2018 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

import RefreshQueue from './refresh_queue';

(function (can, $) {
  can.Model.Cacheable('can.Model.Join', {
    join_keys: null,
    setup: function () {
      this._super.apply(this, arguments);
    },
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
      function reinit(ev, instance) {
        let refreshQueue;
        if (instance instanceof can.Model.Join) {
          instance.reinit();
          refreshQueue = new RefreshQueue();
          can.each(instance.constructor.join_keys, function (cls, key) {
            let obj;
            if (instance[key]) {
              if (instance[key].reify && instance[key].reify().refresh) {
                obj = instance[key].reify();
              } else {
                obj = cls.findInCacheById(instance[key].id);
              }
            }
            if (obj) {
              refreshQueue.enqueue(obj);
            }
          });
          refreshQueue.trigger();
        }
      }
      if (this === can.Model.Join) {
        this.bind('created', reinit);
        this.bind('destroyed', reinit);
      }
    },
  }, {
    init: function () {
      this._super.apply(this, arguments);
      can.each(this.constructor.join_keys, function (cls, key) {
        this.bind(key + '.stub_destroyed', function () {
          // Trigger `destroyed` on self, since it was destroyed on the server
          this.destroyed();
        }.bind(this));
      }.bind(this));
    },

    reinit: function () {
      this.init_join_objects();
    },

    init_join_object_with_type: function (attr) {
      let objectId;
      let objectType;
      if (this[attr] instanceof can.Model) {
        return;
      }

      objectId = this[attr + '_id'] || (this[attr] || {}).id;
      objectType = this[attr + '_type'] || (this[attr] || {}).type;

      if (objectId && objectType && typeof objectType === 'string') {
        this.attr(attr, CMS.Models.get_instance(
              objectType
            , objectId
            , this[attr]
            ) || this[attr]);
      } else if (objectId) {
        this.attr(attr, CMS.Models.get_instance(this[attr]));
      }
    },

    init_join_object: function (attr, modelName) {
      let objectId = this[attr + '_id'] || (this[attr] || {}).id;

      if (objectId) {
        this.attr(
            attr,
            CMS.Models.get_instance(
              modelName, objectId, this[attr]
            ).stub() || this[attr]
        );
      }
    },

    init_join_objects: function () {
      let that = this
        ;

      can.each(this.constructor.join_keys, function (model, attr) {
        if (model === can.Model.Cacheable) {
          that.init_join_object_with_type(attr);
        } else {
          that.init_join_object(attr, model.shortName);
        }
      });
    },
  });

  can.Model.Join('CMS.Models.Snapshot', {
    root_object: 'snapshot',
    root_collection: 'snapshots',
    attributes: {
      context: 'CMS.Models.Context.stub',
      modified_by: 'CMS.Models.Person.stub',
      parent: 'CMS.Models.Cacheable.stub',
    },
    join_keys: {
      parent: can.Model.Cacheable,
      revision: can.Model.Revision,
    },
    defaults: {
      parent: null,
      revision: null,
    },
    findAll: 'GET /api/snapshots',
    update: 'PUT /api/snapshots/{id}',
    child_instance: function (snapshotData) {
    },
    snapshot_instance: function (snapshotData) {
    },
  }, {
    reinit: function () {
      let revision = CMS.Models.Revision.findInCacheById(this.revision_id);
      this.content = revision.content;
    },
    display_name: function () {
      return this._super.call(this.revision.content);
    },
    display_type: function () {
      return this._super.call(this.revision.content);
    },
  });

  can.Model.Join('CMS.Models.Relationship', {
    root_object: 'relationship',
    root_collection: 'relationships',
    attributes: {
      context: 'CMS.Models.Context.stub',
      modified_by: 'CMS.Models.Person.stub',
      source: 'CMS.Models.get_stub',
      destination: 'CMS.Models.get_stub',
    },
    join_keys: {
      source: can.Model.Cacheable,
      destination: can.Model.Cacheable,
    },
    defaults: {
      source: null,
      destination: null,
    },
    findAll: 'GET /api/relationships',
    create: 'POST /api/relationships',
    update: 'PUT /api/relationships/{id}',
    destroy: 'DELETE /api/relationships/{id}',
  }, {
    reinit: function () {
      this.attr('source', CMS.Models.get_instance(
        this.source_type ||
          (this.source &&
            (this.source.constructor &&
              this.source.constructor.shortName ||
              (!this.source.selfLink && this.source.type))),
          this.source_id || (this.source && this.source.id),
          this.source) || this.source);
      this.attr('destination', CMS.Models.get_instance(
        this.destination_type ||
          (this.destination &&
            (this.destination.constructor &&
              this.destination.constructor.shortName ||
              (!this.source.selfLink && this.destination.type))),
        this.destination_id || (this.destination && this.destination.id),
        this.destination) || this.destination);
    },
    unmap: function (cascade) {
      return $.ajax({
        type: 'DELETE',
        url: '/api/relationships/' + this.attr('id') +
          '?cascade=' + cascade,
      })
      .done(function () {
        can.trigger(this.constructor, 'destroyed', this);
      }.bind(this));
    },
  });

  can.Model.Join('CMS.Models.UserRole', {
    root_object: 'user_role',
    root_collection: 'user_roles',
    findAll: 'GET /api/user_roles',
    update: 'PUT /api/user_roles/{id}',
    create: 'POST /api/user_roles',
    destroy: 'DELETE /api/user_roles/{id}',
    attributes: {
      context: 'CMS.Models.Context.stub',
      modified_by: 'CMS.Models.Person.stub',
      person: 'CMS.Models.Person.stub',
      role: 'CMS.Models.Role.stub',
    },
    join_keys: {
      person: CMS.Models.Person,
      role: CMS.Models.Role,
    },
  }, {
    save: function () {
      let role;
      let _super = this._super;

      if (this.role && !this.role_name) {
        return _super.apply(this, arguments);
      }

      role = _.find(CMS.Models.Role.cache, {name: this.role_name});
      if (role) {
        this.attr('role', role.stub());
        return _super.apply(this, arguments);
      }
      return CMS.Models.Role.findAll({
        name__in: this.role_name,
      }).then(function (role) {
        if (!role.length) {
          return new $.Deferred().reject('Role not found');
        }
        role = role[0];
        this.attr('role', role.stub());
        return _super.apply(this, arguments);
      }.bind(this));
    },
  });

  can.Model.Join('CMS.Models.ObjectPerson', {
    root_object: 'object_person',
    root_collection: 'object_people',
    findAll: 'GET /api/object_people',
    create: 'POST /api/object_people',
    update: 'PUT /api/object_people/{id}',
    destroy: 'DELETE /api/object_people/{id}',
    join_keys: {
      personable: can.Model.Cacheable,
      person: CMS.Models.Person,
    },
    attributes: {
      context: 'CMS.Models.Context.stub',
      modified_by: 'CMS.Models.Person.stub',
      person: 'CMS.Models.Person.stub',
      personable: 'CMS.Models.get_stub',
    },

  }, {});

  can.Model.Join('CMS.Models.MultitypeSearchJoin', {
    join_keys: {},
  }, {});

  can.Model.Join('CMS.Models.AuditObject', {
    root_object: 'audit_object',
    root_collection: 'audit_objects',
    findAll: 'GET /api/audit_objects',
    create: 'POST /api/audit_objects',
    destroy: 'DELETE /api/audit_objects/{id}',
    join_keys: {
      auditable: can.Model.Cacheable,
      audit: CMS.Models.Audit,
    },
    attributes: {
      context: 'CMS.Models.Context.stub',
      modified_by: 'CMS.Models.Person.stub',
      audit: 'CMS.Models.Audit.stub',
      auditable: 'CMS.Models.get_stub',
    },
  }, {});
})(window.can, window.can.$);
