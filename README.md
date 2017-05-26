# reconsiderdb-ast

This package is a subset officially supported JavaScript
[rethinkdb driver](https://github.com/rethinkdb/rethinkdb) for querying
a RethinkDB database from a JavaScript application. It does not include
any _network connectiviy_ parts of the standard driver, and the `rethinkdb`
object will not have a `run()` method defined on them. Instead, this is meant
to be used to build/generate a query AST using the `build()` method.

Check out
[rethinkdb.com/api/javascript](http://www.rethinkdb.com/api/javascript)
for documentation and examples of using the official driver.

## Building

This package is built _directly_ from the official JavaScript driver and
uses [Esprima](http://esprima.org/) parse and remove network connection
peices from the default query builder.

To recompile, execute:

```bash
$ npm run build
```

## Naming

In order to comply with §6 of the Apache License, this package is named
`reconsiderdb-ast`.

## Versioning

The version of this package will be locked to the offical driver
version number that it was generated from.

## Licensing

The licensing of this package will match the version of the

