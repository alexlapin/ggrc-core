import ggrc
import time
from datetime import datetime
from flask.ext.testing import TestCase
from ggrc.models.mixins import Base
from ggrc.services.common import Resource
from wsgiref.handlers import format_date_time

class MockModel(Base, ggrc.db.Model):
  __tablename__ = 'test_model'

class MockResourceService(Resource):
  _model = MockModel

  def object_for_json_container(self, object):
    obj = super(MockResourceService, self).object_for_json_container(object)
    obj['modified_by_id'] = unicode(object.modified_by_id)
    return obj

URL_MOCK_COLLECTION = '/api/mock_resources'
URL_MOCK_RESOURCE = '/api/mock_resources/{}'
MockResourceService.add_to(ggrc.app, URL_MOCK_COLLECTION)

class TestResource(TestCase):
  def setUp(self):
    ggrc.db.create_all()

  def tearDown(self):
    ggrc.db.session.remove()
    ggrc.db.drop_all()

  def create_app(self):
    ggrc.app.testing = True
    ggrc.app.debug = False
    return ggrc.app

  def mock_url(self, resource=None):
    if resource is not None:
      return URL_MOCK_RESOURCE.format(resource)
    return URL_MOCK_COLLECTION

  def http_timestamp(self, timestamp):
    return format_date_time(time.mktime(timestamp.utctimetuple()))

  def assertRequiredHeaders(
      self, response, headers={'Content-Type': 'application/json',}):
    self.assertIn('Etag', response.headers)
    self.assertIn('Last-Modified', response.headers)
    self.assertIn('Content-Type', response.headers)
    for k,v in headers.items():
      print 'validating header {}'.format(k)
      self.assertEquals(v, response.headers.get(k))

  def test_empty_collection_get(self):
    response = self.client.get(self.mock_url())
    self.assert200(response)

  def test_missing_resource_get(self):
    response = self.client.get(self.mock_url('foo'))
    self.assert404(response)

  def test_collection_get(self):
    date1 = datetime(2013, 4, 17, 0, 0, 0, 0)
    date2 = datetime(2013, 4, 20, 0, 0, 0, 0)
    mock1 = MockModel(modified_by_id=42, created_at=date1, updated_at=date1)
    mock2 = MockModel(modified_by_id=43, created_at=date2, updated_at=date2)
    ggrc.db.session.add(mock1)
    ggrc.db.session.add(mock2)
    ggrc.db.session.commit()
    response = self.client.get(self.mock_url())
    self.assert200(response)
    self.assertRequiredHeaders(
        response,
        { 'Last-Modified': self.http_timestamp(date2),
          'Content-Type': 'application/json',
        })
    self.assertIn('test_model_collection', response.json)
    self.assertEqual(2, len(response.json['test_model_collection']))
    self.assertIn('selfLink', response.json['test_model_collection'])
    self.assertIn('test_model', response.json['test_model_collection'])
    collection = response.json['test_model_collection']['test_model']
    self.assertEqual(2, len(collection))
    self.assertDictEqual(
        { u'id': mock2.id,
          u'selfLink': u'/api/mock_resources/{}'.format(mock2.id),
          u'modified_by_id': unicode(mock2.modified_by_id),
          u'updated_at': u'2013-04-20T00:00:00',
          u'created_at': u'2013-04-20T00:00:00',
        },
        collection[0]
        )
    self.assertDictEqual(
        { u'id': mock1.id,
          u'selfLink': u'/api/mock_resources/{}'.format(mock1.id),
          u'modified_by_id': unicode(mock1.modified_by_id),
          u'updated_at': u'2013-04-17T00:00:00',
          u'created_at': u'2013-04-17T00:00:00',
        },
        collection[1]
        )
