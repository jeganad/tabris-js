import {expect, mockTabris, spy, stub, restore} from '../test';
import NativeObject from '../../src/tabris/NativeObject';
import ProxyStore from '../../src/tabris/ProxyStore';
import NativeBridge from '../../src/tabris/NativeBridge';
import ClientStub from './ClientStub';

describe('NativeObject', function() {

  let client;

  beforeEach(function() {
    client = new ClientStub();
    mockTabris(client);
  });

  afterEach(restore);

  describe('constructor', function() {

    it('prevents instantiation', function() {
      expect(() => {
        new NativeObject();
      }).to.throw(Error, 'Cannot instantiate abstract NativeObject');
    });

  });

  describe('_create', function() {

    let TestType, object;

    beforeEach(function() {
      TestType = class TestType extends NativeObject {};
      object = new TestType();
      client.resetCalls();
    });

    it('calls native create with properties', function() {
      NativeObject.defineProperties(TestType.prototype, {foo: 'any'});

      object._create('TestType', {foo: 23});

      let calls = client.calls({op: 'create', type: 'TestType'});
      expect(calls.length).to.equal(1);
      expect(calls[0].properties).to.eql({foo: 23});
    });

    it('translates properties', function() {
      NativeObject.defineProperties(TestType.prototype, {bar: {type: 'proxy'}});
      let other = new TestType();

      object._create('TestType', {bar: other});

      let properties = client.calls({op: 'create', id: object.cid})[0].properties;
      expect(properties.bar).to.equal(other.cid);
    });

  });

  describe('instance', function() {

    let TestType, object;

    beforeEach(function() {
      TestType = class TestType extends NativeObject {};
      object = new TestType();
      client.resetCalls();
      stub(console, 'warn');
    });

    it('isDisposed() returns false', function() {
      expect(object.isDisposed()).to.equal(false);
    });

    describe('get', function() {

      it('calls property getter', function() {
        Object.defineProperty(TestType.prototype, 'foo', {get: () => 23});

        let result = object.get('foo');

        expect(result).to.equal(23);
      });

      it('calls property getter on super class', function() {
        Object.defineProperty(TestType.prototype, 'foo', {get: () => 23});
        class SubType extends TestType {}
        object = new SubType();

        let result = object.get('foo');

        expect(result).to.equal(23);
      });

      it('returns undefined for non-existing property', function() {
        let result = object.get('unknown');

        expect(result).to.be.undefined;
      });

    });

    describe('set', function() {

      it('calls property setter', function() {
        let setter = spy();
        Object.defineProperty(TestType.prototype, 'foo', {set: setter});

        object.set('foo', 23);

        expect(setter).to.have.been.calledWith(23);
      });

      it('supports property objects', function() {
        Object.assign(TestType.prototype, {foo: 0, bar: 0});

        object.set({foo: 23, bar: 42});

        expect(object.foo).to.equal(23);
        expect(object.bar).to.equal(42);
      });

      it('calls property setter on super class', function() {
        let setter = spy();
        Object.defineProperty(TestType.prototype, 'foo', {set: setter});
        class SubClass extends TestType {}
        object = new SubClass();

        object.set('foo', 23);

        expect(setter).to.have.been.calledWith(23);
      });

      it('does not set non-existing property', function() {
        object.set('unknown', 23);

        expect(object.unknown).to.be.undefined;
      });

      it('prints warnings for non-existing property', function() {
        object.set('unknown', 23);

        expect(console.warn).to.have.been.calledWith('Unknown property "unknown"');
      });

      it('returns self to allow chaining', function() {
        let result = object.set('foo', 23);

        expect(result).to.equal(object);
      });

    });

    describe('_nativeSet', function() {

      it('calls native SET', function() {
        object._nativeSet('foo', 23);

        let call = client.calls()[0];
        expect(call.id).to.equal(object.cid);
        expect(call.op).to.equal('set');
        expect(call.properties).to.eql({foo: 23});
      });

      it('fails on disposed object', function() {
        object.dispose();

        expect(() => {
          object._nativeSet('foo', 23);
        }).to.throw(Error, 'Object is disposed');
      });

    });

    describe('_nativeGet', function() {

      it('calls native GET', function() {
        object._nativeGet('foo');

        let call = client.calls()[0];
        expect(call.id).to.equal(object.cid);
        expect(call.op).to.equal('get');
        expect(call.property).to.equal('foo');
      });

      it('returns value from native', function() {
        stub(client, 'get').returns(23);

        let result = object._nativeGet('foo');

        expect(result).to.equal(23);
      });

      it('fails on disposed object', function() {
        object.dispose();

        expect(() => {
          object._nativeGet('foo');
        }).to.throw(Error, 'Object is disposed');
      });

    });

    describe('_nativeCall', function() {

      it('calls native CALL', function() {
        object._nativeCall('method', {foo: 23});

        let call = client.calls()[0];
        expect(call.id).to.equal(object.cid);
        expect(call.op).to.equal('call');
        expect(call.method).to.equal('method');
        expect(call.parameters).to.eql({foo: 23});
      });

      it('returns value from native', function() {
        stub(client, 'call').returns(23);

        let result = object._nativeCall('method', {});

        expect(result).to.equal(23);
      });

      it('fails on disposed object', function() {
        object.dispose();

        expect(() => {
          object._nativeCall('foo', {});
        }).to.throw(Error, 'Object is disposed');
      });

    });

    describe('_nativeListen', function() {

      it('calls native LISTEN with true', function() {
        object._nativeListen('foo', true);

        let call = client.calls()[0];
        expect(call).to.deep.equal({op: 'listen', id: object.cid, event: 'foo', listen: true});
      });

      it('calls native LISTEN with false', function() {
        object._nativeListen('foo', false);

        let call = client.calls()[0];
        expect(call).to.deep.equal({op: 'listen', id: object.cid, event: 'foo', listen: false});
      });

      it('fails on disposed object', function() {
        object.dispose();

        expect(() => {
          object._nativeListen('foo', true);
        }).to.throw(Error, 'Object is disposed');
      });

    });

    describe('_trigger', function() {

      let listener;

      beforeEach(function() {
        listener = spy();
      });

      it('notifies listeners', function() {
        object.on('bar', listener);

        object._trigger('bar', {bar: 23});

        expect(listener).to.have.been.calledOnce;
        expect(listener).to.have.been.calledWith({target: object, bar: 23});
      });

    });

    describe('on', function() {

      let listener;

      beforeEach(function() {
        listener = spy();
        spy(object, '_listen');
      });

      it('calls _listen with true for first listener', function() {
        object.on('foo', listener);

        expect(object._listen).to.have.been.calledWith('foo', true);
      });

      it('does not call _listen for subsequent listeners for the same event', function() {
        object.on('bar', listener);
        object.on('bar', listener);

        expect(object._listen).to.have.been.calledOnce;
      });

      it('returns self to allow chaining', function() {
        let result = object.on('foo', listener);

        expect(result).to.equal(object);
      });

      it('does not fail on disposed object', function() {
        object.dispose();

        expect(() => {
          object.on('foo', listener);
        }).not.to.throw();
      });

    });

    describe('off', function() {

      let listener;

      beforeEach(function() {
        listener = spy();
        object.on('foo', listener);
        spy(object, '_listen');
      });

      it('calls _listen with false for last listener removed', function() {
        object.off('foo', listener);

        expect(object._listen).to.have.been.calledOnce;
        expect(object._listen).to.have.been.calledWith('foo', false);
      });

      it('does not call _listen when other listeners exist for same event', function() {
        object.on('foo', spy());
        object.off('foo', listener);

        expect(object._listen).to.not.have.been.calledWith('foo', false);
      });

      it('returns self to allow chaining', function() {
        let result = object.off('foo', listener);

        expect(result).to.equal(object);
      });

      it('does not fail on disposed object', function() {
        object.dispose();

        expect(() => {
          object.off('foo', listener);
        }).not.to.throw();
      });

    });

    describe('dispose', function() {

      it('calls native destroy', function() {
        object.dispose();

        let destroyCall = client.calls({op: 'destroy', id: object.cid})[0];
        expect(destroyCall).not.to.be.undefined;
      });

      it('notifies dispose listeners', function() {
        let listener = spy();
        object.on('dispose', listener);

        object.dispose();

        expect(listener).to.have.been.calledWith({target: object});
      });

      it('notifies dispose listeners before native destroy', function() {
        object.on('dispose', () => {
          expect(client.calls({op: 'destroy'}).length).to.eql(0);
        });

        object.dispose();
      });

      it('does not call native destroy twice when called twice', function() {
        object.dispose();
        object.dispose();

        expect(client.calls({op: 'destroy'}).length).to.equal(1);
      });

      it('can be called from within a dispose listener', function() {
        object.on('dispose', () => object.dispose());

        expect(() => {
          object.dispose();
        }).not.to.throw();
      });

    });

    describe('when disposed', function() {

      beforeEach(function() {
        object.dispose();
      });

      it('isDisposed returns true', function() {
        expect(object.isDisposed()).to.equal(true);
      });

    });

  });

});

describe('NativeObject.extend', function() {

  let client, CustomWidget;

  beforeEach(function() {
    client = new ClientStub();
    global.tabris = {
      on: () => {},
      _proxies: new ProxyStore()
    };
    global.tabris._nativeBridge = new NativeBridge(client);
    stub(console, 'warn');
    CustomWidget = NativeObject.extend('custom.Widget');
    NativeObject.defineProperties(CustomWidget.prototype, {foo: true});
  });

  afterEach(restore);

  it('creates a constructor', function() {
    let instance = new CustomWidget({foo: 42});

    expect(instance).to.be.instanceof(CustomWidget);
    expect(instance).to.be.instanceof(NativeObject);
  });

  it('creates a non-empty cid', function() {
    let instance = new CustomWidget();

    expect(typeof instance.cid).to.equal('string');
    expect(instance.cid.length).to.be.above(0);
  });

  it('issues a create operation with type and properties', function() {
    let instance = new CustomWidget({foo: 23});
    let createCall = client.calls({op: 'create', id: instance.cid})[0];

    expect(createCall.type).to.equal('custom.Widget');
    expect(createCall.properties.foo).to.equal(23);
  });

});
