// priority: 0

import { $BlockRightClickedEventJS } from "packages/dev/latvian/mods/kubejs/block/$BlockRightClickedEventJS";
import { $InteractionHand } from "packages/net/minecraft/world/$InteractionHand";

const Boolean = Java.loadClass('java.lang.Boolean')

const ServerContext = Java.loadClass('dan200.computercraft.shared.computer.core.ServerContext')

BlockEvents.rightClicked("ticketing:ticket_reader", event => {
    if(!event.block.getEntityData().attachments[0].items.isEmpty()) return;
    if(event.getItem().id == "ticketing:ticket" && event.getItem().nbt.UseCount < event.getItem().nbt.MaxUses) {
        if(event.hand == $InteractionHand.OFF_HAND) return;
        if(performReadTicket(event, event.player.inventory.extractItem(event.player.selectedSlot, 1, true))) {
            event.player.inventory.extractItem(event.player.selectedSlot, 1, false);
        }
    }
})

ServerEvents.recipes(event => {
    event.shaped(
        Item.of("ticketing:ticket_machine", 1),
        [
            "IDI",
            "RFB",
            "IDI"
        ],
        {
            I: "create:industrial_iron_block",
            D: "minecraft:diamond",
            R: "minecraft:redstone",
            F: "suppsquared:metal_frame",
            B: "minecraft:black_dye"
        }
    );

    event.shaped(
        Item.of("ticketing:ticket_reader", 1),
        [
            "IEI",
            "RFL",
            "IPI"
        ],
        {
            I: "create:industrial_iron_block",
            E: "minecraft:emerald",
            R: "minecraft:redstone",
            P: "minecraft:paper",
            F: "suppsquared:metal_frame",
            L: "minecraft:light_blue_dye"
        }
    )
})

/**
 * @param {$BlockRightClickedEventJS} event 
 * @param {$ItemStack_} stack
 */
function performReadTicket(event, stack) {
    if(event.block.up.hasTag(new ResourceLocation('computercraft', 'computer'))) {
        event.player.swing(event.hand);
        let e = event.block.getEntityData();
        e.attachments[0].items.push(stack);
        event.block.setEntityData(e);

        let computerId = event.block.up.entity.getComputerID();
        console.log(`up block is computer ${computerId}!`);
        
        ServerContext.get(event.server)
            .registry()
            .getComputers()
            .stream()
            .filter(v => v.getInstanceID() == computerId)
            .findFirst()
            .orElseThrow()
            .queueEvent('ticket_redeemed', [event.player.username]);

        return true;
    } else {
        event.player.sendSystemMessage(Component.translatable("text.ticketing:ticket_reader.requires_computer_above"))

        console.log('up block is not computer');
        return false;
    }
}
