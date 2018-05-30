/*
  Copyright (C) 2018 Google Inc.
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

describe('GGRC.Components.revisionLog', function () {
  'use strict';

  let viewModel;

  beforeAll(function () {
    viewModel = GGRC.Components.getViewModel('revisionLog');
  });

  afterAll(function () {
    viewModel = GGRC.Components.getViewModel('revisionLog');
  });

  describe('defining default scope values', function () {
    it('sets the instance to null', function () {
      expect(viewModel.attr('instance')).toBeNull();
    });

    it('sets the change history to an empty array', function () {
      expect(viewModel.attr('changeHistory').length).toEqual(0);
    });
  });

  describe('fetchItems() method', function () {
    let dfdFetchData;

    beforeEach(function () {
      dfdFetchData = new can.Deferred();
      spyOn(viewModel, '_fetchRevisionsData').and.returnValue(dfdFetchData);
    });

    afterEach(function () {
      viewModel._fetchRevisionsData.calls.reset();
    });

    afterAll(function () {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });

    it('displays a toaster error if fetching the data fails', function () {
      let trigger = spyOn($.prototype, 'trigger');

      viewModel.fetchItems();
      dfdFetchData.reject('Server error');

      expect(trigger).toHaveBeenCalledWith(
        'ajax:flash',
        {error: 'Failed to fetch revision history data.'}
      );
    });

    it('on successfully fetching the data it sets the correctly sorted ' +
      'change history in the scope',
      function () {
        let actual;
        let expected;

        let fetchedRevisions = new can.Map({
          object: new can.List([
            {id: 10},
          ]),
          mappings: new can.List([
            {id: 20},
          ]),
        });

        let mapChange = {updatedAt: new Date('2015-12-21')};
        let mapChange2 = {updatedAt: new Date('2016-03-17')};

        let objChange = {updatedAt: new Date('2016-04-14')};
        let objChange2 = {updatedAt: new Date('2014-11-18')};
        let objChange3 = {updatedAt: new Date('2016-01-09')};

        viewModel.attr('changeHistory', []);

        spyOn(viewModel, '_computeMappingChanges').and.returnValue(
          new can.List([mapChange, mapChange2])
        );
        spyOn(viewModel, '_computeRoleChanges');
        spyOn(viewModel, '_computeObjectChanges').and.returnValue(
          new can.List([objChange, objChange2, objChange3])
        );
        // end fixture

        viewModel.fetchItems();
        dfdFetchData.resolve(fetchedRevisions);

        // check that correct data has been used to calculate the history
        expect(viewModel._computeObjectChanges)
          .toHaveBeenCalledWith(fetchedRevisions.object);
        expect(viewModel._computeMappingChanges)
          .toHaveBeenCalledWith(fetchedRevisions.mappings);

        // check the actual outcome
        actual = can.makeArray(viewModel.attr('changeHistory'));
        actual = _.map(actual, function (item) {
          return item.attr();
        });
        // sorted by newest to oldest
        expected = [objChange, mapChange2, objChange3, mapChange, objChange2];

        expect(actual).toEqual(expected);
      }
    );
  });

  describe('_computeObjectChanges() method', function () {
    afterEach(function () {
      viewModel._objectChangeDiff.calls.reset();
    });

    afterAll(function () {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });

    it('computes an empty list on empty Revision history', function () {
      let result;
      let revisions = new can.List();

      spyOn(viewModel, '_objectChangeDiff');
      result = viewModel._computeObjectChanges(revisions);

      expect(result.length).toEqual(0);
    });

    it('computes diff objects for all successive Revision pairs', function () {
      let result;

      let revisions = [
        {id: 10}, {id: 20}, {id: 30},
      ];

      let diff = {
        madeBy: 'John',
        changes: [
          {fieldName: 'foo'},
        ],
      };
      let diff2 = {
        madeBy: 'Doe',
        changes: [
          {fieldName: 'bar'},
        ],
      };

      spyOn(viewModel, '_objectChangeDiff').and.returnValues(diff, diff2);

      result = viewModel._computeObjectChanges(revisions);

      expect(viewModel._objectChangeDiff.calls.count()).toEqual(3);

      expect(result.length).toEqual(2);
      expect(result[0]).toEqual(diff);
      expect(result[1]).toEqual(diff2);
    });

    it('omits the diff objects with an empty changes list from the result',
      function () {
        let result;

        let revisions = [
          {id: 10}, {id: 20},
        ];

        let diff = {
          changes: [],
        };
        spyOn(viewModel, '_objectChangeDiff').and.returnValue(diff);

        result = viewModel._computeObjectChanges(revisions);

        expect(result.length).toEqual(0);
      }
    );
  });

  describe('_objectChangeDiff() method', function () {
    let origModelAttrDefs = GGRC.model_attr_defs;  // original user-friendly attribute name settings

    beforeAll(function () {
      spyOn(viewModel, '_objectCADiff').and.returnValue({});
      spyOn(viewModel, '_computeRoleChanges').and.returnValue([]);
      spyOn(viewModel, '_getRoleAtTime').and.returnValue('none');
      viewModel.attr('_LIST_FIELDS', {fake_list: 1});
    });
    beforeEach(function () {
      GGRC.model_attr_defs = {};
    });

    afterAll(function () {
      GGRC.model_attr_defs = origModelAttrDefs;
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });

    it('includes the modification time in the result', function () {
      let rev1 = {
        updated_at: '2016-01-24T10:05:42',
        modified_by: 'User 1',
        content: {},
      };
      let rev2 = {
        updated_at: '2016-01-30T08:15:11',
        modified_by: 'User 1',
        content: {},
      };

      let result = viewModel._objectChangeDiff(rev1, rev2);

      expect(result.updatedAt).toEqual('2016-01-30T08:15:11');
    });

    it('includes the author of the change(s) in the result', function () {
      let rev1 = {
        updated_at: '2016-01-24T10:05:42',
        modified_by: 'User 6',
        content: {},
      };
      let rev2 = {
        updated_at: '2016-01-30T08:15:11',
        modified_by: 'User 7',
        content: {},
      };

      let result = viewModel._objectChangeDiff(rev1, rev2);

      expect(result.madeBy).toEqual('User 7');
    });

    it('includes the author\'s role of the change(s) in the result',
      function () {
        let rev1 = {
          updated_at: '2016-01-24T10:05:42',
          modified_by: 'User 6',
          content: {},
        };
        let rev2 = {
          updated_at: '2016-01-30T08:15:11',
          modified_by: 'User 7',
          content: {},
        };

        let result = viewModel._objectChangeDiff(rev1, rev2);
        expect(result.role).toEqual('none');
      });

    it('dooes not include author\'s details ' +
      'when person is not presented', function () {
      let rev1 = {
        updated_at: '2016-01-24T10:05:42',
        modified_by: 'User 6',
        content: {},
      };
      let rev2 = {
        updated_at: '2016-01-30T08:15:11',
        modified_by: null,
        content: {},
      };

      let result = viewModel._objectChangeDiff(rev1, rev2);
      expect(result.madeBy).toBeNull();
      expect(viewModel._getRoleAtTime)
        .toHaveBeenCalledWith(null, rev2.updated_at);
      expect(result.role).toEqual('none');
    });

    describe('with model attributes definitions defined', function () {
      it('uses the fields\' display names in the result', function () {
        let expectedChange = {
          fieldName: 'Object Name',
          origVal: 'Audit 1.0',
          newVal: 'My Audit 1.0',
        };

        let rev1 = {
          updated_at: '2016-01-25T16:36:29',
          modified_by: {
            reify: function () {
              return 'User 5';
            },
          },
          resource_type: 'Audit',
          content: {
            title: 'Audit 1.0',
          },
        };
        let rev2 = {
          updated_at: '2016-01-30T13:22:59',
          modified_by: {
            reify: function () {
              return 'User 5';
            },
          },
          resource_type: 'Audit',
          content: {
            title: 'My Audit 1.0',
          },
        };
        let result;

        GGRC.model_attr_defs = {
          Audit: [
            {attr_name: 'title', display_name: 'Object Name'},
            {attr_name: 'fake_list', display_name: 'Fake List'},
          ],
        };
        result = viewModel._objectChangeDiff(rev1, rev2);

        expect(result.changes[0]).toEqual(expectedChange);
      });

      it('compacts the list fields in the diff',
        function () {
          let rev1 = {
            updated_at: '2016-01-25T16:36:29',
            modified_by: {
              reify: function () {
                return 'User 5';
              },
            },
            resource_type: 'Audit',
            content: {
              fake_list: 'foo,,bar,',
            },
          };
          let rev2 = {
            updated_at: '2016-01-30T13:22:59',
            modified_by: {
              reify: function () {
                return 'User 5';
              },
            },
            resource_type: 'Audit',
            content: {
              fake_list: ',,bar,baz',
            },
          };
          let result;
          GGRC.model_attr_defs = {
            Audit: [
              {attr_name: 'title', display_name: 'Object Name'},
              {attr_name: 'fake_list', display_name: 'Fake List'},
            ],
          };
          result = viewModel._objectChangeDiff(rev1, rev2);

          expect(result.changes[0]).toEqual({
            fieldName: 'Fake List',
            origVal: 'foo, bar',
            newVal: 'bar, baz',
          });
        }
      );
    });
  });

  describe('_objectCADiff() method', function () {
    it('detects set attributes', function () {
      let oldValues = [];
      let oldDefs = [];
      let newValues = [{
        custom_attribute_id: 1,
        attribute_value: 'custom value',
      }];
      let newDefs = [{
        id: 1,
        title: 'CA',
        attribute_type: 'text',
      }];
      let result = viewModel
        ._objectCADiff(oldValues, oldDefs, newValues, newDefs);
      expect(result).toEqual([{
        fieldName: 'CA',
        origVal: '—',
        newVal: 'custom value',
      }]);
    });

    it('detects unset attributes', function () {
      let oldValues = [{
        custom_attribute_id: 1,
        attribute_value: 'custom value',
      }];
      let oldDefs = [{
        id: 1,
        title: 'CA',
        attribute_type: 'text',
      }];
      let newValues = [];
      let newDefs = [];
      let result = viewModel
        ._objectCADiff(oldValues, oldDefs, newValues, newDefs);
      expect(result).toEqual([{
        fieldName: 'CA',
        origVal: 'custom value',
        newVal: '—',
      }]);
    });

    it('detects multiple changed attributes', function () {
      let oldValues = [{
        custom_attribute_id: 1,
        attribute_value: 'v1',
      }, {
        custom_attribute_id: 2,
        attribute_value: 'v2',
      }, {
        custom_attribute_id: 3,
        attribute_value: 'v3',
      }];

      let oldDefs = [{
        id: 1,
        title: 'CA1',
        attribute_type: 'text',
      }, {
        id: 2,
        title: 'CA2',
        attribute_type: 'text',
      }, {
        id: 3,
        title: 'CA3',
        attribute_type: 'text',
      }];

      let newValues = [{
        custom_attribute_id: 1,
        attribute_value: 'v3',
      }, {
        custom_attribute_id: 2,
        attribute_value: 'v4',
      }, {
        custom_attribute_id: 3,
        attribute_value: 'v3',
      }];

      let result = viewModel
        ._objectCADiff(oldValues, oldDefs, newValues, oldDefs);
      expect(result).toEqual([{
        fieldName: 'CA1',
        origVal: 'v1',
        newVal: 'v3',
      }, {
        fieldName: 'CA2',
        origVal: 'v2',
        newVal: 'v4',
      }]);
    });

    it('should not return diffs if definitions are empty', () => {
      const defs = [];
      const oldValues = [{
        custom_attribute_id: 1,
        attribute_value: 'v1',
      }];

      const newValues = [{
        custom_attribute_id: 1,
        attribute_value: 'v3',
      }];

      const result = viewModel
        ._objectCADiff(oldValues, defs, newValues, defs);
      expect(result.length).toBe(0);
    });
  });

  describe('_fetchRevisionsData() method', function () {
    let Revision;  // the Revision object constructor

    // fake Deferred objects to return from the mocked Revision.findAll()
    let dfdResource;
    let dfdSource;
    let dfdDestination;

    beforeEach(function () {
      // obtain a reference to the method under test, and bind it to a fake
      // instance context
      viewModel.attr('instance', {
        id: 123,
        type: 'ObjectFoo',
      });
      viewModel._fetchEmbeddedRevisionData = function () {
        return can.Deferred().resolve([]);
      };
    });

    afterAll(function () {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });

    beforeEach(function () {
      // mock the Revision model's findAll() method
      Revision = CMS.Models.Revision;

      dfdResource = new can.Deferred();
      dfdSource = new can.Deferred();
      dfdDestination = new can.Deferred();

      spyOn(Revision, 'findAll').and.callFake(function (options) {
        if (options.resource_type) {
          return dfdResource;
        } else if (options.source_type) {
          return dfdSource;
        } else if (options.destination_type) {
          return dfdDestination;
        }
        throw new Error('Revision.findAll() invoked with unexpected options.');
      });
    });

    it('fetches the Revision history of the correct object', function () {
      viewModel._fetchRevisionsData();

      expect(Revision.findAll).toHaveBeenCalledWith({
        resource_type: 'ObjectFoo',
        resource_id: 123,
        __sort: 'updated_at',
      });
    });

    it('fetches the Revision history of the correct object ' +
      'as a mapping source',
      function () {
        viewModel._fetchRevisionsData();

        expect(Revision.findAll).toHaveBeenCalledWith({
          source_type: 'ObjectFoo',
          source_id: 123,
          __sort: 'updated_at',
        });
      }
    );

    it('fetches the Revision history of the correct object ' +
      'as a mapping destination',
      function () {
        viewModel._fetchRevisionsData();

        expect(Revision.findAll).toHaveBeenCalledWith({
          destination_type: 'ObjectFoo',
          destination_id: 123,
          __sort: 'updated_at',
        });
      }
    );

    it('resolves the returned Deferred with the fetched data', function () {
      let result;
      let successHandler;

      let objRevisions = new can.List([
        {revision: 'objFoo'}, {revision: 'objBar'},
      ]);
      let mappingSrcRevisions = new can.List([
        {revision: 'mappingSrcFoo'},
      ]);
      let mappingDestRevisions = new can.List([
        {revision: 'mappingDestFoo'},
      ]);

      successHandler = jasmine.createSpy().and.callFake(function (revisions) {
        let objRevisions = can.makeArray(revisions.object);
        let mappingsRevisions = can.makeArray(revisions.mappings);

        function canMapToObject(item) {
          return item.attr();
        }
        objRevisions = _.map(objRevisions, canMapToObject);
        mappingsRevisions = _.map(mappingsRevisions, canMapToObject);

        expect(objRevisions).toEqual([
          {revision: 'objFoo'}, {revision: 'objBar'},
        ]);
        expect(mappingsRevisions).toEqual([
          {revision: 'mappingSrcFoo'}, {revision: 'mappingDestFoo'},
        ]);
      });

      result = viewModel._fetchRevisionsData();
      result.then(successHandler);

      dfdResource.resolve(objRevisions);
      dfdSource.resolve(mappingSrcRevisions);
      dfdDestination.resolve(mappingDestRevisions);

      // check that the returned Deferred has indeed been resolved
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('_computeMappingChanges() method', function () {
    beforeAll(function () {
      spyOn(viewModel, '_mappingChange');
    });

    afterEach(function () {
      viewModel._mappingChange.calls.reset();
    });

    afterAll(function () {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });

    it('creates a list of mapping changes from a Revision list', function () {
      let result;
      let revisions = new can.List([
        {id: 10, madeBy: 'John'},
        {id: 20, madeBy: 'Doe'},
      ]);

      viewModel._mappingChange.and.callFake(function (revision) {
        return new can.Map({madeBy: revision.madeBy});
      });

      result = viewModel._computeMappingChanges(revisions);

      // we call attr() to get a plain object needed for the comparison
      expect(result[0].attr()).toEqual({madeBy: 'John'});
      expect(result[1].attr()).toEqual({madeBy: 'Doe'});
      expect(viewModel._mappingChange.calls.count()).toEqual(2);
    });
  });

  describe('_mappingChange() method', function () {
    beforeAll(function () {
      viewModel.attr('instance', {
        id: 123,
        type: 'ObjectFoo',
      });
      spyOn(viewModel, '_getRoleAtTime').and.returnValue('none');
    });

    afterAll(function () {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });

    it('returns correct change information when the instance is at the ' +
      '"source" end of the mapping',
      function () {
        let revision = {
          modified_by: 'User 17',
          updated_at: new Date('2015-05-17T17:24:01'),
          action: 'created',
          destination: {
            display_type: function () {
              return 'Other';
            },
            display_name: function () {
              return 'OtherObject';
            },
          },
          source_id: 99,
          source_type: 'OtherObject',
        };

        let result = viewModel._mappingChange(revision, [revision]);

        expect(result).toEqual({
          madeBy: 'User 17',
          role: 'none',
          updatedAt: new Date('2015-05-17T17:24:01'),
          changes: {
            origVal: '—',
            newVal: 'Created',
            fieldName: 'Mapping to Other: OtherObject',
          },
        });
      }
    );

    it('returns correct change information when the instance is at the ' +
      '"destination" end of the mapping',
      function () {
        let revision = {
          modified_by: 'User 17',
          updated_at: new Date('2015-05-17T17:24:01'),
          action: 'deleted',
          source: {
            display_type: function () {
              return 'Other';
            },
            display_name: function () {
              return 'OtherObject';
            },
          },
          destination_id: 123,
          destination_type: 'ObjectFoo',
        };

        let result = viewModel._mappingChange(revision, [revision]);

        expect(result).toEqual({
          madeBy: 'User 17',
          role: 'none',
          updatedAt: new Date('2015-05-17T17:24:01'),
          changes: {
            origVal: 'Created',
            newVal: 'Deleted',
            fieldName: 'Mapping to Other: OtherObject',
          },
        });
      }
    );

    it('returns correct change information ' +
      'when author of the change(s) is not presented', function () {
      let revision = {
        modified_by: null,
        updated_at: new Date('2015-05-17T17:24:01'),
        source: {
          display_type: function () {
            return 'Other';
          },
          display_name: function () {
            return 'OtherObject';
          },
        },
        destination_id: 123,
        destination_type: 'ObjectFoo',
      };

      let result = viewModel._mappingChange(revision, [revision]);

      expect(viewModel._getRoleAtTime)
        .toHaveBeenCalledWith(null, revision.updated_at);
      expect(result).toEqual({
        madeBy: null,
        role: 'none',
        updatedAt: new Date('2015-05-17T17:24:01'),
        changes: {
          origVal: '—',
          newVal: '',
          fieldName: 'Mapping to Other: OtherObject',
        },
      });
    });

    it('returns correct change information when map with ' +
      '"snapshot" objects',
    function () {
      let snapshotRevision = {
        modified_by: 'User 17',
        updated_at: new Date('2015-05-17T17:24:01'),
        action: 'created',
        content: {
          updated_at: new Date('2018-02-14T10:46:02'),
          description: 'Description for: CustomControl',
          title: 'CustomControl',
          type: 'Control',
        },
      };

      let revision = {
        modified_by: 'User 17',
        updated_at: new Date('2015-05-17T17:24:01'),
        action: 'created',
        destination: {
          revision: snapshotRevision,
          display_type: function () {
            return snapshotRevision.content.type;
          },
          display_name: function () {
            return snapshotRevision.content.title;
          },
        },
        source_id: 99,
        source_type: 'OtherObject',
      };

      let result = viewModel._mappingChange(revision, [revision]);

      expect(result).toEqual({
        madeBy: 'User 17',
        role: 'none',
        updatedAt: new Date('2015-05-17T17:24:01'),
        changes: {
          origVal: '—',
          newVal: 'Created',
          fieldName: 'Mapping to Control: CustomControl',
        },
      });
    }
    );
  });

  describe('_computeRoleChanges method', function () {
    let corruptedRevision = new can.Map({
      object: new can.List([
        {
          id: 10,
          modified_by: {
            id: 166,
          },
        },
      ]),
      mappings: new can.List([
        {
          id: 1,
          modified_by: {
            id: 166,
          },
          action: 'created',
          source_type: 'Person',
          source_id: 166,
          destination_type: 'ObjectFoo',
          destination_id: 123,
          updated_at: new Date(2016, 0, 1),
          type: 'Revision',
          content: {
            attrs: {},
          },
        },
      ]),
    });
    let revisions = new can.Map({
      object: new can.List([
        {
          id: 10,
          modified_by: {
            id: 166,
          },
        },
      ]),
      mappings: new can.List([
        {
          id: 1,
          modified_by: {
            id: 166,
          },
          action: 'created',
          source_type: 'Person',
          source_id: 166,
          destination_type: 'ObjectFoo',
          destination_id: 123,
          updated_at: new Date(2016, 0, 1),
          type: 'Revision',
          content: {
            attrs: {
              AssigneeType: 'Requester,Assignee',
            },
          },
        },
        {
          id: 2,
          modified_by: {
            id: 166,
          },
          action: 'modified',
          source_type: 'Person',
          source_id: 166,
          destination_type: 'ObjectFoo',
          destination_id: 123,
          updated_at: new Date(2016, 0, 2),
          type: 'Revision',
          content: {
            attrs: {
              AssigneeType: 'Requester,Assignee,Verifier',
            },
          },
        },
        {
          id: 3,
          modified_by: {
            id: 166,
          },
          action: 'modified',
          source_type: 'Person',
          source_id: 166,
          destination_type: 'ObjectFoo',
          destination_id: 123,
          updated_at: new Date(2016, 0, 4),
          type: 'Revision',
          content: {
            attrs: {
              AssigneeType: 'Requester',
            },
          },
        },
        {
          id: 4,
          modified_by: {
            id: 166,
          },
          action: 'deleted',
          source_type: 'Person',
          source_id: 166,
          destination_type: 'ObjectFoo',
          destination_id: 123,
          updated_at: new Date(2016, 0, 5),
          type: 'Revision',
          content: {
            attrs: {
              AssigneeType: 'Requester',
            },
          },
        },
      ]),
    });

    beforeAll(function () {
      viewModel.attr('instance', {
        id: 123,
        type: 'ObjectFoo',
        created_at: new Date(2016, 0, 1),
        'class': {
          assignable_list: [{
            type: 'requester',
            mapping: 'related_requesters',
          }, {
            type: 'assignee',
            mapping: 'related_assignees',
          }, {
            type: 'verifier',
            mapping: 'related_verifiers',
          }],
        },
        get_binding: function (mappingName) {
          let bindingData = {
            related_requesters: {
              list: [
                {
                  instance: {id: 166},
                },
              ],
            },
            related_assignees: {
              list: [
                {
                  instance: {id: 166},
                },
              ],
            },
            related_verifiers: {
              list: [
                {
                  instance: {id: 166},
                },
              ],
            },
          };
          return bindingData[mappingName];
        },
      });
    });

    afterAll(function () {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });
    it('returns current max role when no revisions exist', function () {
      let roleHistory = viewModel._computeRoleChanges([]);
      expect(roleHistory).toEqual({
        '166': [{
          role: 'Verifier',
          updated_at: new Date(2016, 0, 1),
        }],
      });
    });

    it('returns correct full history when present', function () {
      let roleHistory = viewModel._computeRoleChanges(revisions);
      expect(roleHistory).toEqual({
        '166': [
          {
            updated_at: new Date(2016, 0, 1),
            role: 'Assignee',
          },
          {
            updated_at: new Date(2016, 0, 2),
            role: 'Verifier',
          },
          {
            updated_at: new Date(2016, 0, 4),
            role: 'Requester',
          },
          {
            updated_at: new Date(2016, 0, 5),
            role: 'none',
          },
        ],
      });
    });

    it('builds correct full history when creation is not present', function () {
      let roleHistory;
      revisions.mappings.shift(); // remove first ("created") mapping
      roleHistory = viewModel._computeRoleChanges(revisions);
      expect(roleHistory).toEqual({
        '166': [
          {
            updated_at: new Date(2016, 0, 1),
            role: 'none',
          },
          {
            updated_at: new Date(2016, 0, 2),
            role: 'Verifier',
          },
          {
            updated_at: new Date(2016, 0, 4),
            role: 'Requester',
          },
          {
            updated_at: new Date(2016, 0, 5),
            role: 'none',
          },
        ],
      });
    });

    it('builds correct history when data is corrupted', function () {
      let roleHistory;

      roleHistory = viewModel._computeRoleChanges(corruptedRevision);
      expect(roleHistory).toEqual({
        '166': [
          {
            updated_at: new Date(2016, 0, 1),
            role: 'none',
          },
        ],
      });
    });
  });

  describe('_getRoleAtTime() method', function () {
    beforeAll(function () {
      viewModel.attr('roleHistory', {});
      viewModel.attr('roleHistory')[1] =
        [{
          role: 'creator',
          updated_at: new Date(2016, 0, 1),
        }, {
          role: 'verifier',
          updated_at: new Date(2016, 1, 2),
        }, {
          role: 'assignee',
          updated_at: new Date(2016, 2, 3),
        }];
    });

    afterAll(function () {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });
    it('returns correct role for a given person at initial time', function () {
      expect(viewModel
        ._getRoleAtTime(1, new Date(2016, 0, 1))).toEqual('creator');
    });
    it('returns correct role for a given person on first change', function () {
      expect(viewModel
        ._getRoleAtTime(1, new Date(2016, 1, 2))).toEqual('verifier');
    });
    it('returns correct role for a given person in the middle of interval',
      function () {
        expect(viewModel
          ._getRoleAtTime(1, new Date(2016, 1, 15))).toEqual('verifier');
      });
    it('returns correct role for a given person on third change', function () {
      expect(viewModel
        ._getRoleAtTime(1, new Date(2016, 2, 3))).toEqual('assignee');
    });
    it('returns correct role for a given person after last change',
      function () {
        expect(viewModel
          ._getRoleAtTime(1, new Date(2016, 3, 1))).toEqual('assignee');
      });

    it('returns "none" if there is no known role at that time', function () {
      expect(viewModel
        ._getRoleAtTime(1, new Date(2015, 1, 1))).toEqual('none');
    });
    it('returns "none" if there is no known role if no user history exists',
      function () {
        expect(viewModel
          ._getRoleAtTime(0, new Date(2016, 1, 10))).toEqual('none');
      });
    it('returns "none" if there is no known role and no user history ' +
       'exists on specific dates',
        function () {
          expect(viewModel
            ._getRoleAtTime(0, new Date(2016, 1, 2))).toEqual('none');
        });
    it('returns "none" if user does not exist', function () {
      expect(viewModel
        ._getRoleAtTime(null, new Date(2016, 1, 2))).toEqual('none');
    });
  });

  describe('"_isEqualArrays" method', () => {
    let viewModel;

    beforeEach(() => {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });

    it('should return TRUE. empty arrays', () => {
      let result = viewModel._isEqualArrays([], [], 'id');
      expect(result).toBeTruthy();
    });

    it('should return TRUE. equals arrays', () => {
      let arr1 = [{id: 1}, {id: 3}, {id: 5}];
      let arr2 = [{id: 3}, {id: 5}, {id: 1}];
      let result = viewModel._isEqualArrays(arr1, arr2, 'id');
      expect(result).toBeTruthy();
    });

    it('should return FALSE. different length', () => {
      let arr1 = [{id: 1}, {id: 3}, {id: 5}];
      let arr2 = [{id: 3}, {id: 5}, {id: 1}, {id: 6}];
      let result = viewModel._isEqualArrays(arr1, arr2, 'id');
      expect(result).toBeFalsy();
    });

    it('should return FALSE. one empty array', () => {
      let arr1 = [{id: 1}, {id: 3}, {id: 5}];
      let arr2 = [];
      let result = viewModel._isEqualArrays(arr1, arr2, 'id');
      expect(result).toBeFalsy();
    });

    it('should return FALSE. different data', () => {
      let arr1 = [{id: 1}, {id: 3}, {id: 5}];
      let arr2 = [{id: 1}, {id: 3}, {id: 55}];
      let result = viewModel._isEqualArrays(arr1, arr2, 'id');
      expect(result).toBeFalsy();
    });
  });

  describe('"_buildPeopleEmails" method', () => {
    let viewModel;

    beforeEach(() => {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });

    it('should return array with users emails', () => {
      const userEmail = 'user@example.com';
      let result;

      spyOn(CMS.Models.Person, 'findInCacheById')
        .and.returnValue({email: userEmail});

      result = viewModel._buildPeopleEmails([{id: 1}, {id: 2}]);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual(userEmail);
      expect(result[1]).toEqual(userEmail);
    });

    it('should return array with empty "diff" value. empty array', () => {
      let emptyDiffValue = '—';
      let result = viewModel._buildPeopleEmails([]);
      expect(result.length).toBe(1);
      expect(result[0]).toEqual(emptyDiffValue);
    });
  });

  describe('"_getPeopleForRole" method', () => {
    let viewModel;

    beforeEach(() => {
      viewModel = GGRC.Components.getViewModel('revisionLog');
    });

    it('should return empty list. ACL is undefined', () => {
      let revisionContent = {};
      let role = {id: 1};

      let result = viewModel._getPeopleForRole(role, revisionContent);
      expect(result.length).toBe(0);
    });

    it('should return empty list', () => {
      let revisionContent = {
        access_control_list: [
          {ac_role_id: 5, person: {id: 1}},
          {ac_role_id: 3, person: {id: 55}},
        ],
      };
      let role = {id: 1};
      let result = viewModel._getPeopleForRole(role, revisionContent);

      expect(result.length).toBe(0);
    });

    it('should return 2 persons', () => {
      let revisionContent = {
        access_control_list: [
          {ac_role_id: 5, person: {id: 1}},
          {ac_role_id: 3, person: {id: 55}},
          {ac_role_id: 5, person: {id: 55}},
        ],
      };
      let role = {id: 5};
      let result = viewModel._getPeopleForRole(role, revisionContent);

      expect(result.length).toBe(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(55);
    });
  });
});
