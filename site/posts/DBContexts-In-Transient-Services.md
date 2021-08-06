---
title: No to DbContexts in Transient Services
precis: Why You Shouldn't use DbContexts in Transient Services
date: 2020-10-01
---

While it seems reasonable to use a DBContext in Transient Services, DON'T.

Why? Surely making the service IDisposable and disposing the context in Disposing works. The answer is yes, it will be disposed, but only when the Services Container is Disposed.

When a Transient Service is requested, the Services Container creates an instance of the object, passes a reference to the caller and forgets about it. It doesn't retain a reference as it won't need it again - for every request it creates a new instance. The object instance is cleaned up by the garbage collector when the component using it is disposed. However, if the Transient Service is made IDisposable, the Service Container retains a reference to the object instance and only disposes of it when the Service Container itself is disposed.

The net result is that if you use the Transient Service 100 times in a user session, you will have 100 instances of the Transient Service in the Service Container awaiting disposal.

The solution is to use the IDbContextFactory<TContext> service.