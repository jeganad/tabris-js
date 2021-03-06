import {expect, mockTabris} from '../../test';
import ClientStub from '../ClientStub';
import Tab from '../../../src/tabris/widgets/Tab';
import Composite from '../../../src/tabris/widgets/Composite';

describe('Tab', function() {

  let client;

  beforeEach(function() {
    client = new ClientStub();
    mockTabris(client);
    client.resetCalls();
  });

  describe('when created', function() {

    let tab, create;

    beforeEach(function() {
      tab = new Tab({
        title: 'foo',
        image: {src: 'bar'},
        selectedImage: {src: 'selectedBar'},
        badge: '1',
        background: '#010203',
        visible: false
      });
      create = client.calls({op: 'create', id: tab.cid})[0];
    });

    it('creates a Tab', function() {
      expect(create.type).to.equal('tabris.Tab');
      expect(create.id).to.equal(tab.cid);
      expect(create.properties.title).to.equal('foo');
    });

    it('getter returns initial properties', function() {
      tab = new Tab();
      expect(tab.get('title')).to.equal('');
      expect(tab.get('image')).to.equal(null);
      expect(tab.get('selectedImage')).to.equal(null);
      expect(tab.get('badge')).to.equal('');
      expect(tab.get('visible')).to.equal(true);
    });

    it('throws when appended to an illegal parent', function() {
      expect(() => {
        tab.appendTo(new Composite());
      }).to.throw('Tab could not be appended to Composite');
    });

  });

});
