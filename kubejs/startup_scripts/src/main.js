// priority: 0

const UUID = Java.loadClass("java.util.UUID");
const Boolean = Java.loadClass('java.lang.Boolean');

StartupEvents.registry("sound_event", event => {
    event.create("ticketing:ticket.fwoop", 'basic');
    event.create("ticketing:ticket.tear", 'basic');
    event.create("ticketing:ticket.super_tear", 'basic');
})

StartupEvents.registry("block", event => {
    event.create("ticketing:ticket_machine")
        .hardness(-1)
        .property(BlockProperties.HORIZONTAL_FACING)
        .placementState(cb => {
            cb.set(BlockProperties.HORIZONTAL_FACING, cb.player.horizontalFacing.opposite);
        })
        .blockstateJson = {
            variants: {
                "inventory": { model: "ticketing:item/ticket_machine" },
                "facing=north": { model: "ticketing:block/ticket_machine_without_ticket" },
                "facing=east": { model: "ticketing:block/ticket_machine_without_ticket", "y": 90 },
                "facing=south": { model: "ticketing:block/ticket_machine_without_ticket", "y": 180 },
                "facing=west": { model: "ticketing:block/ticket_machine_without_ticket", "y": 270 },
            }
        };
    event.create("ticketing:ticket_reader")
        .hardness(-1)
        .property(BlockProperties.HORIZONTAL_FACING)
        .placementState(cb => {
            cb.set(BlockProperties.HORIZONTAL_FACING, cb.player.horizontalFacing.opposite);
        })
        .defaultState(s => {
            s.set(BlockProperties.HORIZONTAL_FACING, Direction.north);
        })
        .blockEntity(entity => {
            entity.inventory(1, 1);
        })
        .blockstateJson = {
            variants: {
                "inventory": { model: "ticketing:item/ticket_reader" },
                "facing=north": { model: "ticketing:block/ticket_reader" },
                "facing=east": { model: "ticketing:block/ticket_reader", "y": 90 },
                "facing=south": { model: "ticketing:block/ticket_reader", "y": 180 },
                "facing=west": { model: "ticketing:block/ticket_reader", "y": 270 },
            }
        };
});

function buildLore(source, destination, system, uses, useCount) {
    if(source.provider && destination.provider && (
        (source.providerId && destination.providerId && source.providerId != destination.providerId) ||
        (source.provider != destination.provider)
    )) {
        return [
            Component.literal(`← ${source.name ?? source} (${source.provider})`).blue().italic(false),
            Component.literal(`→ ${destination.name ?? destination} (${destination.provider})`).green().italic(false),
            Component.literal('MULTI-PROVIDER TICKET').red().bold(true).italic(false).underlined(true),
            Component.empty(),
            Component.literal("Issuing service provider:").gray().italic(false),
            Component.literal(system.name ?? system).lightPurple().italic(false),
            system.provider ? Component.literal(system.provider).lightPurple().italic(false) : null,
            Component.empty(),
            Component.literal("Non-certified, tradable service ticket.").green().italic(false).underlined(true),
            Component.empty(),
            Component.literal("Valid for above listed service providers only.").gray().italic(false),
            Component.literal(`Void after ${uses - useCount} use${(uses - useCount) != 1 ? 's' : ''}`).gray().italic(false),
        ].filter(v => v != null)
    }

    return [
        Component.literal(`${source.name ?? source} → ${destination.name ?? destination}`).blue().italic(false),
        (source.system && destination.system && (
            (source.systemId && destination.systemId && system.id && ((source.systemId != system.id) || (destination.systemId != system.id))) ||
            ((source.system != (system.name ?? system)) || (destination.system != (system.name ?? system)))
        )) ? Component.literal(`${source.system ?? destination.system}`).blue().italic(false) : null,
        Component.empty(),
        Component.literal("Issuing service provider:").gray().italic(false),
        Component.literal(system.name ?? system).lightPurple().italic(false),
        system.provider ? Component.literal(system.provider).lightPurple().italic(false) : null,
        Component.empty(),
        Component.literal("Non-certified, tradable service ticket.").green().italic(false).underlined(true),
        Component.empty(),
        Component.literal("Valid for above service provider only.").gray().italic(false),
        Component.literal(`Void after ${uses - useCount} use${(uses - useCount) != 1 ? 's' : ''}`).gray().italic(false),
    ].filter(v => v != null)
}

function buildTicket(source, destination, system, authorizedReaders, id, uses, useCount) {
    return Item.of("ticketing:ticket", 1).withNBT({
        TicketId: id,
        Source: source,
        Destination: destination,
        System: system,
        AuthorizedReaders: authorizedReaders,
        MaxUses: uses,
        UseCount: useCount
    }).withLore(buildLore(source, destination, system, uses, useCount));
}

/**
 * @param {$BlockContainerJS_} block
 * @param {array[]} args
 */
function printTicket(block, _side, args, _computer, _ctx) {
    if(args.length < 1) {
        return { success: false, error: "invalid argument; expecting a single table" };
    }

    const object = args[0];
    const source = object.source;
    const destination = object.destination;
    const system = object.system;

    if(!source || !destination || !system) {
        return { success: false, error: "`source`, `destination`, and `system` are required keys" };
    }

    if(!system.id || !system.providerId) {
        return { success: false, error: "`system` must at least contain `id` and `providerId`"};
    }

    const uses = object.uses ?? 1;
    const existingUses = object.existingUses ?? 0;

    let authorizedReaders;

    if(object.authorizedReaders) {
        authorizedReaders = [];

        // attempt to convert lua array to actually useful array
        for(let i = 1.0; object.authorizedReaders.containsKey(i); i += 1.0) {
            authorizedReaders.push(object.authorizedReaders.get(i));
        }
    } else {
        authorizedReaders = [{ system: system.id, provider: system.providerId }];
    }

    if(existingUses >= uses) {
        return { success: false, error: "cannot print a ticket with no uses remaining" };
    }

    if(authorizedReaders.length == 0) {
        return { success: false, error: "cannot print a ticket that cannot be read" };
    }

    if(system.id && !authorizedReaders.find((r, _idx, _obj) => r.system == system.id && r.provider == system.providerId)) {
        return { success: false, error: "printing service provider must be included as an authorized reader" };
    }

    const id = UUID.randomUUID().toString();

    const targetFace = block.blockState.getValue(BlockProperties.HORIZONTAL_FACING)
    block.popItemFromFace(buildTicket(source, destination, system, authorizedReaders, id, uses, existingUses), targetFace);
    const marker = block.getLevel().createEntity('marker');
    marker.pos = block.pos.center;
    block.getLevel().playSound(marker, block.pos, 'ticketing:ticket.fwoop', 'blocks', 1.0, 1.0);
    marker.remove('discarded');

    return { success: true, id: id };
}

/**
 * @param {$BlockContainerJS_} block
 * @param {any[]} args
 */
function getTicketInfo(block, _side, args, _computer, _ctx) {
    if(block.entityData.attachments[0].items.length == 0) {
        return [null, "no ticket inserted"];
    }

    const tag = block.entityData.attachments[0].items[0].tag;
    const auth = args.length > 0 ? args[0] : null;

    if(!auth) {
        return [null, "must pass authorization information; expecting a table containing `systemId` and `providerId`"];
    }

    if(!tag.AuthorizedReaders.find(r => r.system == auth.systemId && r.provider == auth.providerId)) {
        return [null, "not an authorized reader"];
    }

    return {
        source: tag.Source.name == undefined ? tag.Source : {
            id: tag.Source.id,
            name: tag.Source.name,
            system: tag.Source.system,
            systemId: tag.Source.systemId,
            provider: tag.Source.provider,
            providerId: tag.Source.providerId
        },
        destination: tag.Destination.name == undefined ? tag.Destination : {
            id: tag.Destination.id,
            name: tag.Destination.name,
            system: tag.Destination.system,
            systemId: tag.Destination.systemId,
            provider: tag.Destination.provider,
            providerId: tag.Destination.providerId
        },
        system: tag.System.name == undefined ? tag.System : {
            id: tag.System.id,
            name: tag.System.name,
            provider: tag.System.provider,
            providerId: tag.System.providerId
        },
        uniqueId: tag.TicketId,
        maxUses: tag.MaxUses,
        useCount: tag.UseCount
    }
}

/**
 * @param {$BlockContainerJS_} block
 */
function consumeTicketUse(block, _side, _args, _computer, _ctx) {
    const d = block.entityData;

    if(d.attachments[0].items.length == 0) {
        return [false, false, "no ticket inserted"]
    }

    const item = d.attachments[0].items[0]

    if(item.tag.UseCount >= item.tag.MaxUses) {
        return [false, false, "max usage count reached"]
    }

    item.tag.UseCount += 1

    const marker = block.level.createEntity('marker');
    marker.pos = block.pos.center;
    if(item.tag.UseCount == item.tag.MaxUses) {
        d.attachments[0].items = [];
        block.level.playSound(marker, block.pos, 'ticketing:ticket.super_tear', 'blocks', 1.0, 1.0);
    } else {
        d.attachments[0].items[0] = item;
        block.level.playSound(marker, block.pos, 'ticketing:ticket.tear', 'blocks', 1.0, 1.0);
    }

    block.setEntityData(d);
    marker.remove('discarded');

    return [/* success */ true, /* consumed */ item.tag.UseCount == item.tag.MaxUses]
}

/**
 * @param {$BlockContainerJS_} block
 */
function deleteTicket(block, _side, _args, _computer, _ctx) {
    const d = block.entityData;

    if(d.attachments[0].items.length == 0) {
        return [false, false, "no ticket inserted"]
    }

    const item = d.attachments[0].items[0]

    const marker = block.level.createEntity('marker');
    marker.pos = block.pos.center;
    d.attachments[0].items = [];
    block.level.playSound(marker, block.pos, 'ticketing:ticket.super_tear', 'blocks', 1.0, 1.0);

    block.setEntityData(d);
    marker.remove('discarded');

    return [/* success */ true, /* consumed */ item.tag.UseCount == item.tag.MaxUses]
}

/**
 * @param {$BlockContainerJS_} block
 */
function dropTicket(block, _side, _args, _computer, _ctx) {
    const d = block.entityData;

    if(d.attachments[0].items.length == 0) {
        return [false, "no ticket inserted"]
    }

    const item = d.attachments[0].items[0]
    d.attachments[0].items = [];

    item.tag.display = {}
    const source = item.tag.Source;
    const destination = item.tag.Destination;
    const system = item.tag.System;
    const uses = item.tag.MaxUses;
    const useCount = item.tag.UseCount;

    let i = Item.of("ticketing:ticket", 1)
        .withNBT(item.tag)
        .withLore(buildLore(source, destination, system, uses, useCount));
    i.setDamageValue(Math.round((useCount / uses) * 100));

    block.popItemFromFace(i, block.blockState.getValue(BlockProperties.HORIZONTAL_FACING));
    block.setEntityData(d);

    const marker = block.level.createEntity('marker');
    marker.pos = block.pos.center;
    block.level.playSound(marker, block.pos, 'ticketing:ticket.fwoop', 'blocks', 1.0, 1.0);
    marker.remove('discarded');

    return true
}

ComputerCraftEvents.peripheral(event => {
    event.registerPeripheral("ticket_printer", "ticketing:ticket_machine")
        .mainThreadMethod("printTicket", printTicket);
    event.registerPeripheral("ticket_reader", "ticketing:ticket_reader")
        .mainThreadMethod("getTicketInfo", getTicketInfo)
        .mainThreadMethod("consumeTicketUse", consumeTicketUse)
        .mainThreadMethod("deleteTicket", consumeTicketUse)
        .mainThreadMethod("dropTicket", dropTicket);
});

StartupEvents.registry("item", event => {
    event.create("ticketing:ticket")
        .maxDamage(100)
        .texture("ticketing:item/ticket");
});
