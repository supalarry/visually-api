# lilvideo

## Lil Installation

1. Install lil dependencies

```
npm install
```

2. Add `.env` file in the lil root repository & paste API keys

3. Start lil project
```
nodemon source/server.ts
```

4. Access lil API on `localhost:1337`

## Usage

The endpoints can be seen in. (ignore multer.ts in source file, it is a service)

```
source/routes
```

The controllers that actually run functionality for each route are stored in
```
source/controllers
```

In short, routes tell API endpoints, and controllers run functionality.
